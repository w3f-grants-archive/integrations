use ethers_providers::{ProviderError, JsonRpcClient};

use async_trait::async_trait;
use serde::{de::DeserializeOwned, Serialize};
use std::{
    str::FromStr,
    sync::atomic::{AtomicU64, Ordering},
};
use thiserror::Error;
use super::wrap::ProviderModule;
use super::wrap::imported::ArgsRequest;

#[derive(Debug)]
pub struct Provider {
}

#[derive(Error, Debug)]
/// Error thrown when sending an HTTP request
pub enum ClientError {
    #[error("Deserialization Error: {err}. Response: {text}")]
    /// Serde JSON Error
    SerdeJson { err: serde_json::Error, text: String },
}

impl From<ClientError> for ProviderError {
    fn from(src: ClientError) -> Self {
        match src {
            _ => ProviderError::JsonRpcClientError(Box::new(src)),
        }
    }
}

#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
impl JsonRpcClient for Provider {
    type Error = ClientError;

    /// Sends a POST request with the provided method and the params serialized as JSON
    /// over HTTP
    async fn request<T: Serialize + Send + Sync, R: DeserializeOwned>(
        &self,
        method: &str,
        params: T,
    ) -> Result<R, ClientError> {
        let res = ProviderModule::request(&ArgsRequest {method: method.to_string(), params: None}).expect("provider request failed");
        let res = serde_json::from_str(&res)
            .map_err(|err| ClientError::SerdeJson { err, text: "from str failed".to_string() })?;
        Ok(res)
    }
}

impl Provider {
    pub fn new() -> Self {
        Self {}
    }
}

impl Clone for Provider {
    fn clone(&self) -> Self {
        Self {  }
    }
}
