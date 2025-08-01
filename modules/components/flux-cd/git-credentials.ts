import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface GitCredentialsArgs {
  kubernetesProvider: k8s.Provider;
  name: string;
  namespace?: string;
  credentials: {
    type: "token" | "ssh" | "basic";
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    token?: pulumi.Input<string>;
    privateKey?: pulumi.Input<string>;
    knownHosts?: pulumi.Input<string>;
  };
}

export class GitCredentials extends pulumi.ComponentResource {
  public readonly secret: k8s.core.v1.Secret;

  constructor(
    name: string,
    args: GitCredentialsArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:flux:GitCredentials", name, {}, opts);

    const namespace = args.namespace || "flux-system";

    if (args.credentials.type === "ssh") {
      this.secret = new k8s.core.v1.Secret(
        `${name}-ssh-secret`,
        {
          metadata: {
            name: args.name,
            namespace: namespace,
          },
          type: "Opaque",
          stringData: {
            identity: args.credentials.privateKey!,
            "identity.pub": "", // Optional: public key
            known_hosts: args.credentials.knownHosts || "",
          },
        },
        {
          parent: this,
          provider: args.kubernetesProvider,
        }
      );
    } else if (args.credentials.type === "token") {
      this.secret = new k8s.core.v1.Secret(
        `${name}-token-secret`,
        {
          metadata: {
            name: args.name,
            namespace: namespace,
          },
          type: "Opaque",
          stringData: {
            username: "git", // Standard for token auth
            password: args.credentials.token!,
          },
        },
        {
          parent: this,
          provider: args.kubernetesProvider,
        }
      );
    } else {
      // basic auth
      this.secret = new k8s.core.v1.Secret(
        `${name}-basic-secret`,
        {
          metadata: {
            name: args.name,
            namespace: namespace,
          },
          type: "Opaque",
          stringData: {
            username: args.credentials.username!,
            password: args.credentials.password!,
          },
        },
        {
          parent: this,
          provider: args.kubernetesProvider,
        }
      );
    }

    this.registerOutputs({
      secretName: this.secret.metadata.name,
    });
  }
}