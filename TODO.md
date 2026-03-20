[x] - integration with keychain to store the password and keys securely
[] - calls that fail to be mined within some time due to low gas or other error should be retried, maybe with a larger gas
[] - if there is a failed call and new call is submitted, ask the user if they want to retry or replace the existing call. Make sure to only do this if the new call is for the same account and network. If during submitting the new call the old one propagated on chain first, then show a notification that old call successful, and the new one should be retried (with higher nonce)
[] - allow cancelling a call that is yet to be mined, show confirmation if cancellation is successful or not.
