/**
 * Credential vault — Stage 1 stub.
 *
 * Later stages issue short-lived credentials into the workstation at
 * execution time. Agents never receive raw secrets. Being first-party
 * does not grant a bypass.
 */
export class CredentialVault {
  // Reserved: no stored credentials in Stage 1.
  peek(_name: string): never {
    throw new Error(
      "Credential access is not implemented in Stage 1, and agents cannot retrieve secrets.",
    );
  }
}
