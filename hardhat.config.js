require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy');
require('./tasks/mint-tokens.js');

const accounts = {
  mnemonic: `${process.env.MNEMONIC}`,
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.11",
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    polygon: {
      url: 'https://rpc-mainnet.maticvigil.com',
      accounts,
      chainId: 137,
      live: true,
      saveDeployments: true,
      gasPrice: 30000000000
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com/',
      accounts,
      chainId: 80001,
      live: true,
      saveDeployments: true,
      gasPrice: 39000000000
    },
    hardhat: {
      chainId: 137
    },
    rinkeby: {
        chainId: 4,
        accounts,
        url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
        live: true,
        saveDeployments: true,
    }
  },
};
