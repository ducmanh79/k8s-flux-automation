// components/flux-cd/index.ts
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as tls from "@pulumi/tls";
import * as github from "@pulumi/github";
import * as flux from "@worawat/flux";
import { eks } from "@pulumi/aws";
import { secretKey } from "@pulumi/aws/config";
import { kubernetes } from "@worawat/flux/config";
import { GitCredentialsArgs } from "./git-credentials";

export { FluxApp, FluxAppArgs } from "./flux-app";
export { GitCredentials, GitCredentialsArgs } from "./git-credentials";

export interface FluxCDComponentArgs {
  kubernetesProvider: k8s.Provider;
  cluster: any; // EKS cluster reference
  gitRepositories?: {
    name: string;
    url: string;
    branch?: string;
    secretRef?: string;
    path?: string;
  }[];
}

export class FluxCDComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly fluxRelease: k8s.helm.v3.Release;
  public readonly gitRepositories: k8s.apiextensions.CustomResource[] = [];

  // Helper method to create git credentials
  public createGitCredentials(
    name: string,
    credentials: GitCredentialsArgs["credentials"],
    kubernetesProvider: k8s.Provider
  ) {
    const { GitCredentials } = require("./git-credentials");
    return new GitCredentials(
      `flux-${name}`,
      {
        kubernetesProvider: kubernetesProvider,
        name: name,
        credentials: credentials,
      },
      { parent: this }
    );
  }

  constructor(
    name: string,
    args: FluxCDComponentArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:flux:FluxCDComponent", name, {}, opts);

    // Create Flux namespace
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: "flux-system",
          labels: {
            "app.kubernetes.io/instance": "flux-system",
            "app.kubernetes.io/part-of": "flux",
          },
        },
      },
      {
        parent: this,
        provider: args.kubernetesProvider,
        dependsOn: [args.cluster],
      }
    );

    // Install Flux using Helm
    this.fluxRelease = new k8s.helm.v3.Release(
      `${name}-flux`,
      {
        chart: "flux2",
        version: "2.12.1",
        repositoryOpts: {
          repo: "https://fluxcd-community.github.io/helm-charts",
        },
        namespace: this.namespace.metadata.name,
        values: {
          sourceController: { create: true },
          kustomizeController: { create: true },
          helmController: { create: true },
          notificationController: { create: true },
          imageReflectorController: { create: true },
          imageAutomationController: { create: true },
        },
      },
      {
        parent: this,
        provider: args.kubernetesProvider,
        dependsOn: [this.namespace],
      }
    );

    // Create GitRepository resources
    if (args.gitRepositories) {
      args.gitRepositories.forEach((repo, index) => {
        this.createGitRepository(name, repo, index, args.kubernetesProvider);
      });
    }

    this.registerOutputs({
      namespaceName: this.namespace.metadata.name,
      fluxVersion: this.fluxRelease.version,
    });
  }

  private createGitRepository(
    name: string,
    repo: { name: string; url: string; branch?: string; secretRef?: string },
    index: number,
    provider: pulumi.ProviderResource
  ) {
    const gitRepo = new k8s.apiextensions.CustomResource(
      `${name}-git-repo-${index}`,
      {
        apiVersion: "source.toolkit.fluxcd.io/v1beta2",
        kind: "GitRepository",
        metadata: {
          name: repo.name,
          namespace: this.namespace.metadata.name,
        },
        spec: {
          interval: "5m",
          url: repo.url,
          ref: {
            branch: repo.branch || "main",
          },
          ...(repo.secretRef && {
            secretRef: {
              name: repo.secretRef,
            },
          }),
        },
      },
      {
        parent: this,
        provider: provider,
        dependsOn: [this.fluxRelease],
      }
    );

    this.gitRepositories.push(gitRepo);
  }
}
