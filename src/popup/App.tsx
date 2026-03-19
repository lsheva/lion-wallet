import Router, { Route } from "preact-router";
import { walletState } from "./mock/state";
import { DevToolbar } from "./mock/DevToolbar";
import { Welcome } from "./pages/Welcome";
import { SetPassword } from "./pages/SetPassword";
import { SeedPhrase } from "./pages/SeedPhrase";
import { ConfirmSeed } from "./pages/ConfirmSeed";
import { ImportWallet } from "./pages/ImportWallet";
import { Unlock } from "./pages/Unlock";
import { Home } from "./pages/Home";
import { Send } from "./pages/Send";
import { Receive } from "./pages/Receive";
import { TxApproval } from "./pages/TxApproval";
import { SignMessage } from "./pages/SignMessage";
import { Settings } from "./pages/Settings";
import { TxResult } from "./pages/TxResult";
import { SignResult } from "./pages/SignResult";
import { AutoLockTimer } from "./pages/AutoLockTimer";
import { ExportPrivateKey } from "./pages/ExportPrivateKey";
import { ShowRecoveryPhrase } from "./pages/ShowRecoveryPhrase";

export function App() {
  return (
    <div class="relative mx-auto bg-base" style={{ width: 360, minHeight: 600, maxHeight: 600, overflow: "hidden" }}>
      <div class="h-[600px] overflow-y-auto overflow-x-hidden">
        <Router>
          <Route path="/" component={Welcome} />
          <Route path="/set-password" component={SetPassword} />
          <Route path="/seed-phrase" component={SeedPhrase} />
          <Route path="/confirm-seed" component={ConfirmSeed} />
          <Route path="/import" component={ImportWallet} />
          <Route path="/unlock" component={Unlock} />
          <Route path="/home" component={Home} />
          <Route path="/send" component={Send} />
          <Route path="/receive" component={Receive} />
          <Route path="/tx-approval" component={TxApproval} />
          <Route path="/sign-message" component={SignMessage} />
          <Route path="/tx-success" component={() => <TxResult status="success" />} />
          <Route path="/tx-error" component={() => <TxResult status="error" />} />
          <Route path="/sign-success" component={() => <SignResult status="success" />} />
          <Route path="/sign-error" component={() => <SignResult status="error" />} />
          <Route path="/settings" component={Settings} />
          <Route path="/auto-lock" component={AutoLockTimer} />
          <Route path="/export-key" component={ExportPrivateKey} />
          <Route path="/show-phrase" component={ShowRecoveryPhrase} />
        </Router>
      </div>
      {import.meta.env.DEV && <DevToolbar />}
    </div>
  );
}
