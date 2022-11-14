use crate::{Error, Metadata};
pub use base_api::BaseApi;
use delegate::delegate;
use serde::de::DeserializeOwned;
use sp_core::H256;
use sp_runtime::traits::Header;
use sp_version::RuntimeVersion;

mod base_api;
mod constant_api;
mod extrinsic_api;
mod storage_api;

/// A more complex Api which requires prefetching some fields such as Metadata, genesis_hash and
/// runtime version
pub struct Api {
    base_api: BaseApi,
    /// The blockchain metadata
    pub metadata: Metadata,
    /// The genesish hash of the blockchain
    pub genesis_hash: H256,
    /// The runtime version of the blockchain
    pub runtime_version: RuntimeVersion,
}

impl Api {
    // delegte function calls to BaseApi
    delegate! {
        to self.base_api {

            #[call(fetch_finalized_head)]
            pub fn chain_get_finalized_head(&self) -> Result<Option<H256>, Error>;

            #[call(fetch_header)]
            pub fn chain_get_header<H>(&self, hash: H256) -> Result<Option<H>,Error>
                where H:Header + DeserializeOwned;

            pub fn author_submit_extrinsic(
                &self,
                hex_extrinsic: String,
            ) -> Result<Option<H256>, Error>;

        }
    }

    /// Try to create an instance of this api
    /// where it fetch metadata, the genesis_hash and runtime_version
    /// This is kind of problematic as the metadata can be pretty large and this adds overhead and
    /// slows everything down...
    pub fn new(url: &str) -> Result<Self, Error> {
        let base_api = BaseApi::new(url);
        let metadata = match base_api.fetch_metadata()? {
            Some(metadata) => metadata,
            None => return Err(Error::NoMetadata),
        };
        let genesis_hash = match base_api.fetch_genesis_hash()? {
            Some(genesis_hash) => genesis_hash,
            None => return Err(Error::NoGenesisHash),
        };
        let runtime_version = match base_api.fetch_runtime_version()? {
            Some(runtime_version) => runtime_version,
            None => return Err(Error::NoRuntimeVersion),
        };

        Ok(Self {
            base_api,
            metadata,
            genesis_hash,
            runtime_version,
        })
    }
}
