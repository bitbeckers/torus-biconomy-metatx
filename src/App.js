import React, { useState, useEffect } from "react";
import "./App.css";
import Button from "@material-ui/core/Button";
import {
  NotificationContainer,
  NotificationManager,
} from "react-notifications";
import "react-notifications/lib/notifications.css";

import { ethers } from "ethers";
import { Biconomy } from "@biconomy/mexa";
import Torus from "@toruslabs/torus-embed";

import { makeStyles } from "@material-ui/core/styles";
import Link from "@material-ui/core/Link";
import Typography from "@material-ui/core/Typography";
import { Box } from "@material-ui/core";

import singlePlayerCommitAbi from "./spcAbi.json";

let sigUtil = require("eth-sig-util");

let config = {};
config.contract = {
  address: "0x6B6FD55b224b25B2F56A10Ce670B097e66Fca136",
  abi: singlePlayerCommitAbi,
  rpcUrl: "https://rpc-mumbai.maticvigil.com/",
};

const domainType = [
  {
    name: "_activityKey",
    type: "bytes32",
  },
  {
    name: "_goalValue",
    type: "uint256",
  },
  {
    name: "_startTime",
    type: "uint256",
  },
  {
    name: "_endTime",
    type: "uint256",
  },
  {
    name: "_stake",
    type: "uint256",
  },
  {
    name: "_depositAmount",
    type: "uint256",
  },
  {
    name: "_userId",
    type: "string",
  },
];

const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" },
];

// const domainData = {
//   name: "SinglePlayerCommit",
//   version: "1",
//   verifyingContract: config.contract.address,
//   salt: "0x" + (80001).toString(16).padStart(64, "0"),
// };

const commitment = {
  _activityKey:
    "0x7c811a21b2f664032d44e98853a7045b8e6b13994831bf3b1d0a63ca27960b4c",
  _depositAmount: 1,
  _endTime: 1617919200,
  _goalValue: 100,
  _stake: 1,
  _startTime: 1617790842,
  _userId: "45977566",
};

let torus, biconomy, ethersProvider;
let salt = 42;
let walletProvider, walletSigner;
let contract, contractInterface;

const useStyles = makeStyles((theme) => ({
  root: {
    "& > * + *": {
      marginLeft: theme.spacing(2),
    },
  },
  link: {
    marginLeft: "5px",
  },
}));

const showErrorMessage = (message) => {
  NotificationManager.error(message, "Error", 5000);
};

const showSuccessMessage = (message) => {
  NotificationManager.success(message, "Message", 3000);
};

const showInfoMessage = (message) => {
  NotificationManager.info(message, "Info", 3000);
};

function App() {
  const classes = useStyles();
  const preventDefault = (event) => event.preventDefault();
  const [owner, setOwner] = useState("Default Owner Address");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [metaTxEnabled, setMetaTxEnabled] = useState(true);
  const [transactionHash, setTransactionHash] = useState("");

  useEffect(() => {
    async function init() {
      if (
        typeof window.ethereum !== "undefined" &&
        window.ethereum.isMetaMask
      ) {
        // Ethereum user detected. You can now use the provider.
        //Torus is the provider used for getting the account and signing the transaction
        torus = new Torus({
          buttonPosition: "bottom-left",
        });

        await torus.init({
          buildEnv: "production",
          enableLogging: true,
          network: {
            host: "mumbai",
            chainId: 80001,
            networkName: "Mumbai Test Network",
          },
          showTorusButton: true,
          // integrity: {
          //   check: false,
          //   version: "1.9.15",
          // },
        });

        await torus.login().then((account) => setSelectedAddress(account[0]));
        console.log("Torus: ", torus);

        //The Biconomy provider is used for communicating with the network
        let jsonRpcProvider = new ethers.providers.JsonRpcProvider(
          config.contract.rpcUrl
        );

        biconomy = new Biconomy(torus.ethereum, {
          walletProvider: torus.provider,
          apiKey: "V7nbIe8Ue.94e3d8fd-2f0d-42cc-96aa-27d57dac9a7c",
          debug: true,
        });

        console.log("Biconomy: ", biconomy);

        // Assign the provider and signer based on Torus
        ethersProvider = new ethers.providers.Web3Provider(biconomy);
        walletProvider = new ethers.providers.Web3Provider(torus.provider);
        walletSigner = walletProvider.getSigner();
        // This web3 instance is used to read normally and write to contract via meta transactions.
        // web3 = new Web3(biconomy);

        let userAddress = await walletSigner.getAddress();
        setSelectedAddress(userAddress);

        biconomy
          .onEvent(biconomy.READY, () => {
            console.log("READY");
            contract = new ethers.Contract(
              config.contract.address,
              config.contract.abi,
              biconomy.getSignerByAddress(userAddress)
            );

            contractInterface = new ethers.utils.Interface(config.contract.abi);
          })
          .onEvent(biconomy.ERROR, (error, message) => {
            // Handle error while initializing mexa
            console.log("ERROR: ", error);
            console.log("MESSAGE: ", message);
          });
      } else {
        showErrorMessage("Metamask not installed");
      }
    }
    init();
  }, []);

  const onSubmit = async (event) => {
    console.log(contract);
    if (contract) {
      setTransactionHash("");
      if (metaTxEnabled) {
        console.log("Sending meta transaction");
        console.log("SelectedAddress: ", selectedAddress);
        const userAddress = selectedAddress;
        const nonce = await contract.getNonce(userAddress);

        console.log(`Got nonce: ${nonce.toString()}`);
        const functionSignature = contractInterface.encodeFunctionData(
          "depositAndCommit",
          [
            commitment._activityKey,
            commitment._goalValue,
            commitment._startTime,
            commitment._endTime,
            commitment._stake,
            commitment._stake,
            commitment._userId,
          ]
        );

        const message = {
          nonce: parseInt(nonce),
          from: userAddress,
          functionSignature: functionSignature,
        };

        const dataToSign = JSON.stringify({
          types: {
            EIP712Domain: domainType,
            MetaTransaction: metaTransactionType,
          },
          domain: commitment,
          primaryType: "MetaTransaction",
          message: message,
        });

        console.log(commitment);
        console.log("Trying to sign and send");
        await torus.provider.send(
          {
            jsonrpc: "2.0",
            id: 999999999999,
            method: "eth_signTypedData_v4",
            params: [userAddress, dataToSign],
          },
          function (error, response) {
            console.info(`User signature is ${response.result}`);
            if (error || (response && response.error)) {
              showErrorMessage("Could not get user signature");
            } else if (response && response.result) {
              const { r, s, v } = getSignatureParameters(response.result);
              console.log(userAddress);
              console.log(JSON.stringify(dataToSign));
              console.log(message);
              console.log(getSignatureParameters(response.result));

              const recovered = sigUtil.recoverTypedSignature_v4({
                data: JSON.parse(dataToSign),
                sig: response.result,
              });
              console.log(`Recovered ${recovered}`);
              sendSignedTransaction(userAddress, functionSignature, r, s, v);
            }
          }
        );
      } else {
        showErrorMessage("MetaTx not enabled");
      }
    } else {
      showErrorMessage("Please enter the quote");
    }
  };

  const getSignatureParameters = (signature) => {
    if (!ethers.utils.isHexString(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    var r = signature.slice(0, 66);
    var s = "0x".concat(signature.slice(66, 130));
    var v = "0x".concat(signature.slice(130, 132));
    v = ethers.BigNumber.from(v).toNumber();
    if (![27, 28].includes(v)) v += 27;
    return {
      r: r,
      s: s,
      v: v,
    };
  };

  const sendSignedTransaction = async (userAddress, functionData, r, s, v) => {
    showInfoMessage("Sending signed transaction");

    try {
      // let gasLimit = await contract
      //   .executeMetaTransaction(userAddress, functionData, r, s, v)
      //   .estimateGas({ from: userAddress });
      // let gasPrice = await ethersProvider.getGasPrice();

      const overrides = {
        from: userAddress,
        gasLimit: 350000,
      };

      // let gasLimit = await contract.estimateGas.executeMetaTransaction(
      //   userAddress,
      //   functionData,
      //   r,
      //   s,
      //   v, overrides
      // );

      const tx = await contract.executeMetaTransaction(
        userAddress,
        functionData,
        r,
        s,
        v,
        overrides
      );

      showInfoMessage(`Transaction sent. Waiting for confirmation ..`);
      await tx.wait(1);
      console.log("Transaction hash : ", tx.hash);
      console.log(tx);
      setTransactionHash(tx.hash);

      showSuccessMessage("Transaction confirmed on chain");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="App">
      <section className="main">
        <div className="mb-attribution">
          <p className="mb-author">{owner}</p>
          <cite>Click to send preconfigured transaction</cite>
        </div>
      </section>
      <section>
        {transactionHash !== "" && (
          <Box className={classes.root} mt={2} p={2}>
            <Typography>
              Check your transaction hash
              <Link
                href={`https://mumbai-explorer.matic.today/tx/${transactionHash}`}
                target="_blank"
                className={classes.link}
              >
                here
              </Link>
            </Typography>
          </Box>
        )}
      </section>
      <section>
        <div className="submit-container">
          <div className="submit-row">
            <Button variant="contained" color="primary" onClick={onSubmit}>
              Deposit DAI and create Commitment
            </Button>
          </div>
        </div>
      </section>
      <NotificationContainer />
    </div>
  );
}

export default App;
