#!/bin/bash

# Function for continue/exit prompt
continue_or_exit() {
    local message="$1"
    echo "$message"
    echo -e "\033[1;34mPress any key to continue, q to quit.\033[0m"
    read -n 1 key
    if [[ $key == "q" ]]; then
        exit 1
    fi
}

echo "Enter the network name (e.g. opsepolia, optimism, sepolia, basesepolia, base):"
read NETWORK

echo "Enter the deployment name (e.g. season01_official, season02_official, etc):"
read DEPLOYMENT_NAME

# Validate network name against supported chains
case $NETWORK in
  "opsepolia"|"optimism"|"sepolia"|"basesepolia"|"base")
    echo "Using network: $NETWORK"
    ;;
  *)
    echo "Error: Invalid network name. Supported networks are:"
    echo "- opsepolia"
    echo "- optimism"
    echo "- sepolia" 
    echo "- basesepolia"
    echo "- base"
    exit 1
    ;;
esac

DEPLOYMENT_NAME="prd"
CONTRACTS_DIR="deployments/$DEPLOYMENT_NAME/$NETWORK"

# Check if contracts directory exists and remove it
if [ -d "$CONTRACTS_DIR" ]; then
    echo "Removing existing contracts directory: $CONTRACTS_DIR"
    rm -rf "$CONTRACTS_DIR"
fi



echo -e "While this script runs, it will deploy the following contracts:"
echo -e "ERC20"
echo -e "Builder NFT"
echo -e "Builder Starter Pack NFT"
echo -e "Vesting"
echo -e "EAS Resolver"
echo -e "Protocol"

continue_or_exit ""

npm run compile
npm run scout:deploy:erc20 $NETWORK -- --deployment $DEPLOYMENT_NAME || exit 1
continue_or_exit "ERC20 deployment completed."

npm run scout:deploy:buildernft $NETWORK -- --deployment $DEPLOYMENT_NAME || exit 1
continue_or_exit "Builder NFT deployment completed."

npm run scout:deploy:starterpack $NETWORK -- --deployment $DEPLOYMENT_NAME || exit 1
continue_or_exit "Builder Starter Pack NFT deployment completed."

npm run scout:deploy:vesting $NETWORK -- --deployment $DEPLOYMENT_NAME || exit 1
continue_or_exit "Vesting deployment completed."

npm run scout:deploy:easresolver $NETWORK -- --deployment $DEPLOYMENT_NAME || exit 1
continue_or_exit "EAS Resolver deployment completed."

npm run scout:deploy:protocol $NETWORK -- --deployment $DEPLOYMENT_NAME || exit 1
echo "Protocol deployment completed."

echo ""
echo "----------------------------------------"
echo ""

echo -e "All contract addresses have been saved to the $CONTRACTS_DIR directory."

echo ""
echo "----------------------------------------"
echo ""

echo -e "Once done, run this command to deploy the safe transaction:"
echo -e "\033[1;34mnpm run scout:launch:season01\033[0m"
