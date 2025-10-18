// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IBloodChain {
    function donationCountPublic(address user) external view returns (uint32);
}

/// @title MedalNFT - Donor achievement NFTs gated by FHE-encrypted counts
contract MedalNFT is ERC721, Ownable, SepoliaConfig {
    IBloodChain public immutable bloodChain;

    /// @dev thresholds for levels (e.g., [5,10,20])
    uint32[] private _thresholds;
    string private _baseURIString;

    uint256 private _nextTokenId = 1;
    mapping(address => mapping(uint256 => bool)) private _claimedLevel; // user => levelIndex => claimed

    event MedalMinted(address indexed user, uint256 indexed tokenId, uint256 levelIndex);

    constructor(address bloodChainAddress, uint32[] memory thresholds, string memory baseURI_) ERC721("BloodChain Medal", "BCMEDAL") Ownable(msg.sender) {
        bloodChain = IBloodChain(bloodChainAddress);
        _thresholds = thresholds;
        _baseURIString = baseURI_;
    }

    function setBaseURI(string calldata newBase) external onlyOwner {
        _baseURIString = newBase;
    }

    function getThresholds() external view returns (uint32[] memory) {
        return _thresholds;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseURIString;
    }

    /// @notice Mint medal for a level index if user's public donation count >= threshold.
    function mintMedal(uint256 levelIndex) external {
        require(levelIndex < _thresholds.length, "invalid level");
        require(!_claimedLevel[msg.sender][levelIndex], "already claimed");

        uint32 count = bloodChain.donationCountPublic(msg.sender);
        require(count >= _thresholds[levelIndex], "insufficient donations");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _claimedLevel[msg.sender][levelIndex] = true;
        emit MedalMinted(msg.sender, tokenId, levelIndex);
    }
}


