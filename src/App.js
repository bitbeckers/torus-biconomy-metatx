import React, { useState, useEffect } from "react";
import "./App.css";
import Button from "@material-ui/core/Button";
import {
  NotificationContainer,
  NotificationManager,
} from "react-notifications";
import "react-notifications/lib/notifications.css";
import Web3 from "web3";
import { Biconomy } from "@biconomy/mexa";
import Torus from "@toruslabs/torus-embed";
import { makeStyles } from "@material-ui/core/styles";
import Link from "@material-ui/core/Link";
import Typography from "@material-ui/core/Typography";
import { Box } from "@material-ui/core";

import singlePlayerCommitAbi from "./spcAbi.json";

const BN = Web3.utils.BN;

let sigUtil = require("eth-sig-util");

let config = {};
config.contract = {
  address: "0x6A383cf1F8897585718DCA629a8f1471339abFe4",
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

const domainData = {
  name: "SinglePlayerCommit",
  version: "1",
  verifyingContract: config.contract.address,
  salt: "0x" + (80001).toString(16).padStart(64, "0"),
};

const commitment = {
  activityKey:
    "0x7c811a21b2f664032d44e98853a7045b8e6b13994831bf3b1d0a63ca27960b4c",
  depositAmount: new BN(1).toString(),
  endTime: 1617919200,
  goalValue: 10,
  stake: Web3.utils.toWei("1"),
  startTime: 1617790842,
  userId: "45977566",
};

let web3;
let provider;
let torus;
let contract;

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

function App() {
  const classes = useStyles();
  const preventDefault = (event) => event.preventDefault();
  const [quote, setQuote] = useState("This is a default quote");
  const [owner, setOwner] = useState("Default Owner Address");
  const [newQuote, setNewQuote] = useState("");
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
        torus = new Torus({
          buttonPosition: "bottom-left",
        });

        await torus.init({
          buildEnv: "production",
          enableLogging: true,
          network: {
            //host: "rinkeby",
            chainId: 80001,
            networkName: "Mumbai Test Network",
          },
          showTorusButton: true,
        });

        await torus.login().then(account => setSelectedAddress(account[0]));
        console.log("Torus: ", torus)

        provider = window.ethereum;

        const biconomy = new Biconomy(provider, {
          apiKey: "gZT51Vc7u.69fff9c5-4afe-4961-aff1-41ab237f97f6",
          debug: true,
        });

        // This web3 instance is used to read normally and write to contract via meta transactions.
        web3 = new Web3(biconomy);

        // web3 = new Web3(provider);
        biconomy
          .onEvent(biconomy.READY, () => {
            console.log("READY");
            contract = new web3.eth.Contract(
              config.contract.abi,
              config.contract.address
            );
            // setSelectedAddress(provider.selectedAddress);
            // provider.on("accountsChanged", function (accounts) {
            //   setSelectedAddress(accounts[0]);
            // });
          })
          .onEvent(biconomy.ERROR, (error, message) => {
            console.log("ERROR: ", error);
            // Handle error while initializing mexa
          });
      } else {
        showErrorMessage("Metamask not installed");
      }
    }
    init();
  }, []);

  const onQuoteChange = (event) => {
    setNewQuote(event.target.value);
  };

  const onSubmit = async (event) => {
    console.log(contract);
    if (contract) {
      setTransactionHash("");
      if (metaTxEnabled) {
        console.log("Sending meta transaction");
        console.log("SelectedAddress: ", selectedAddress)
        let userAddress = selectedAddress;
        let nonce = await web3.eth.getTransactionCount(userAddress, 'pending');

        let functionSignature = contract.methods
          .depositAndCommit(
            commitment.activityKey,
            commitment.goalValue,
            commitment.startTime,
            commitment.endTime,
            commitment.stake,
            commitment.stake,
            commitment.userId
          )
          .encodeABI();
        let message = {};
        message.nonce = parseInt(nonce);
        message.from = userAddress;
        message.functionSignature = functionSignature;

        const dataToSign = JSON.stringify({
          types: {
            EIP712Domain: domainType,
            MetaTransaction: metaTransactionType,
          },
          domain: domainData,
          primaryType: "MetaTransaction",
          message: message,
        });
        console.log(domainData);
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
              let { r, s, v } = getSignatureParameters(response.result);
              console.log(userAddress);
              console.log(JSON.stringify(message));
              console.log(message);
              console.log(getSignatureParameters(response.result));

              const recovered = sigUtil.recoverTypedSignature_v4({
                data: JSON.parse(dataToSign),
                sig: response.result,
              });
              console.log(`Recovered ${recovered}`);
              sendTransaction(userAddress, functionSignature, r, s, v);
            }
          }
        );
      } else {
        console.log("Sending normal transaction");
        contract.methods
          .setQuote(newQuote)
          .send({ from: selectedAddress })
          .on("transactionHash", function (hash) {
            showInfoMessage(`Transaction sent to blockchain with hash ${hash}`);
          })
          .once("confirmation", function (confirmationNumber, receipt) {
            setTransactionHash(receipt.transactionHash);
            showSuccessMessage("Transaction confirmed");
          });
      }
    } else {
      showErrorMessage("Please enter the quote");
    }
  };

  const getSignatureParameters = (signature) => {
    if (!web3.utils.isHexStrict(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    var r = signature.slice(0, 66);
    var s = "0x".concat(signature.slice(66, 130));
    var v = "0x".concat(signature.slice(130, 132));
    v = web3.utils.hexToNumber(v);
    if (![27, 28].includes(v)) v += 27;
    return {
      r: r,
      s: s,
      v: v,
    };
  };

  const showErrorMessage = (message) => {
    NotificationManager.error(message, "Error", 5000);
  };

  const showSuccessMessage = (message) => {
    NotificationManager.success(message, "Message", 3000);
  };

  const showInfoMessage = (message) => {
    NotificationManager.info(message, "Info", 3000);
  };

  const sendTransaction = async (userAddress, functionData, r, s, v) => {
    if (web3 && contract) {
      try {
        let gasLimit = await contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .estimateGas({ from: userAddress });
        let gasPrice = await web3.eth.getGasPrice();
        let tx = contract.methods
          .executeMetaTransaction(userAddress, functionData, r, s, v)
          .send({
            from: userAddress,
          });

        tx.on("transactionHash", function (hash) {
          console.log(`Transaction hash is ${hash}`);
          showInfoMessage(`Transaction sent by relayer with hash ${hash}`);
        }).once("confirmation", function (confirmationNumber, receipt) {
          console.log(receipt);
          setTransactionHash(receipt.transactionHash);
          showSuccessMessage("Transaction confirmed on chain");
          // getQuoteFromNetwork();
        });
      } catch (error) {
        console.log(error);
      }
    }
  };
  const getTransactionReceiptMined = (txHash, interval) => {
    const self = this;
    const transactionReceiptAsync = async function (resolve, reject) {
      var receipt = await web3.eth.getTransactionReceipt(txHash);
      if (receipt == null) {
        setTimeout(
          () => transactionReceiptAsync(resolve, reject),
          interval ? interval : 500
        );
      } else {
        resolve(receipt);
      }
    };

    if (typeof txHash === "string") {
      return new Promise(transactionReceiptAsync);
    } else {
      throw new Error("Invalid Type: " + txHash);
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
            {/* <Button variant="contained" color="primary" onClick={onSubmitWithPrivateKey} style={{marginLeft: "10px"}}>
              Submit (using private key)
            </Button> */}
          </div>
        </div>
      </section>
      <NotificationContainer />
    </div>
  );
}

export default App;
