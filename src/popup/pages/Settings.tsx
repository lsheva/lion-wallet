/**
 * Settings page shell. Each section lives in its own file under
 * [`./settings/`](./settings/). Add new sections to that folder and register
 * them in this list.
 */
import { Show } from "solid-js";
import { Header } from "../components/Header";
import { showNetworkSelector } from "../store";
import { NetworkSelector } from "./NetworkSelector";
import { AddressBook } from "./settings/AddressBook";
import { ApiKeysSection } from "./settings/ApiKeys";
import { ClearCacheRow } from "./settings/ClearCache";
import { Connections } from "./settings/Connections";
import { Network } from "./settings/Network";
import { ResetWalletRow } from "./settings/ResetWallet";
import { Security } from "./settings/Security";
import { ThemeSelector } from "./settings/Theme";
import { UpdateSection } from "./settings/Update";
import { WalletAndAccounts } from "./settings/WalletsAndAccounts";

export function Settings() {
  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Settings" onBack="/home" />

      <div class="flex-1 overflow-y-auto px-4 pt-2 space-y-4 pb-4">
        <WalletAndAccounts />
        <Network />
        <AddressBook />
        <Connections />
        <ApiKeysSection />
        <ThemeSelector />
        <ClearCacheRow />
        <Security />
        <ResetWalletRow />
        <UpdateSection />
      </div>

      <Show when={showNetworkSelector()}>
        <NetworkSelector />
      </Show>
    </div>
  );
}
