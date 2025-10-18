// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, euint8, ebool, externalEuint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title BloodChain - Privacy-aware blood donation recorder using FHEVM
/// @notice Stores donation count as encrypted state and emits public events for transparency.
contract BloodChain is SepoliaConfig {
    /// @dev Encrypted total donation count per user
    mapping(address => euint32) private _encDonationCount;

    /// @dev Last donation encrypted volume per user (for optional FHE analytics)
    mapping(address => euint32) private _encLastVolume;

    /// @dev Public donation count for gating NFT mint (transparent)
    mapping(address => uint32) private _publicDonationCount;

    /// @dev Publicly visible, privacy-preserving record via events
    event DonationRecorded(
        address indexed user,
        string ipfsCid,
        uint64 date, // unix timestamp
        bytes32 locationHash,
        bytes32 hospitalHash,
        uint8 donationType, // 0: whole blood, 1: platelet, ...
        uint32 volume, // public field kept for transparency (can be 0)
        euint32 encVolume // encrypted volume handle for per-record decryption
    );

    /// @notice Record a donation; increments encrypted count and emits a public event.
    /// @param inputVolume Encrypted volume as externalEuint32 (can pass 0 if using public volume)
    /// @param inputProof ZK proof for the encrypted input
    /// @param ipfsCid IPFS CID for off-chain evidence JSON
    /// @param date Unix timestamp of donation
    /// @param locationHash Keccak256 hash of location with user salt (off-chain)
    /// @param hospitalHash Keccak256 hash of hospital with user salt (off-chain)
    /// @param donationType Encoded donation type (0=whole,1=platelet,...)
    /// @param publicVolume Optional public volume for transparency (set to 0 to hide)
    function recordDonation(
        externalEuint32 inputVolume,
        bytes calldata inputProof,
        string calldata ipfsCid,
        uint64 date,
        bytes32 locationHash,
        bytes32 hospitalHash,
        uint8 donationType,
        uint32 publicVolume
    ) external {
        // 1) Load current encrypted count
        euint32 current = _encDonationCount[msg.sender];

        // 2) Increase count by 1 using scalar add for gas efficiency
        euint32 one = FHE.asEuint32(1);
        euint32 next = FHE.add(current, one);

        // 3) Store back and set ACL: contract + caller can decrypt
        _encDonationCount[msg.sender] = next;
        FHE.allowThis(next);
        FHE.allow(next, msg.sender);

        // 4) Capture encrypted volume (optional FHE analytics)
        euint32 vol = FHE.fromExternal(inputVolume, inputProof);
        _encLastVolume[msg.sender] = vol;
        FHE.allowThis(vol);
        FHE.allow(vol, msg.sender);

        // 4.1) Maintain public transparent counter for medal gating
        unchecked {
            _publicDonationCount[msg.sender] += 1;
        }

        // 5) Emit public event with transparency-friendly fields
        emit DonationRecorded(
            msg.sender,
            ipfsCid,
            date,
            locationHash,
            hospitalHash,
            donationType,
            publicVolume,
            vol
        );
    }

    /// @notice Returns the encrypted donation count for the caller.
    /// @dev Frontend can call userDecrypt() with ACL to reveal the clear value.
    function getMyDonationCount() external view returns (euint32) {
        return _encDonationCount[msg.sender];
    }

    /// @notice Returns the encrypted donation count for any user (publicly retrievable, but only ACL holders can decrypt).
    function getDonationCount(address user) external view returns (euint32) {
        return _encDonationCount[user];
    }

    /// @notice Returns the encrypted last volume for the caller.
    function getMyLastVolume() external view returns (euint32) {
        return _encLastVolume[msg.sender];
    }

    /// @notice Returns the public donation count (transparent) for gating purposes.
    function donationCountPublic(address user) external view returns (uint32) {
        return _publicDonationCount[user];
    }
}


