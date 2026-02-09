declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by: string;
  }

  interface GsiButtonConfiguration {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    width?: number;
  }

  function initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
  }): void;

  function renderButton(
    parent: HTMLElement,
    options: GsiButtonConfiguration,
  ): void;

  function prompt(): void;
}

declare namespace google.accounts.oauth2 {
  interface CodeResponse {
    code: string;
    scope: string;
    error?: string;
    error_description?: string;
  }

  interface CodeClientConfig {
    client_id: string;
    scope: string;
    callback: (response: CodeResponse) => void;
    ux_mode?: "popup" | "redirect";
    redirect_uri?: string;
  }

  interface CodeClient {
    requestCode(): void;
  }

  function initCodeClient(config: CodeClientConfig): CodeClient;
}
