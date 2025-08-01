import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface FluxAppArgs {
  kubernetesProvider: k8s.Provider;
  name: string;
  namespace: string;
  gitRepository: {
    name: string; // Reference to existing GitRepository
    path: string;
    branch?: string;
  };
  kustomization?: {
    interval?: string;
    prune?: boolean;
    targetNamespace?: string; // Deploy resources to different namespace
    dependsOn?: string[]; // Other kustomizations to depend on
  };
}

export class FluxApp extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly kustomization: k8s.apiextensions.CustomResource;

  constructor(
    name: string,
    args: FluxAppArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:flux:FluxApp", name, {}, opts);

    // Create namespace if it doesn't exist
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: args.namespace,
        },
      },
      {
        parent: this,
        provider: args.kubernetesProvider,
      }
    );

    // Create Kustomization resource
    this.kustomization = new k8s.apiextensions.CustomResource(
      `${name}-kustomization`,
      {
        apiVersion: "kustomize.toolkit.fluxcd.io/v1",
        kind: "Kustomization",
        metadata: {
          name: args.name,
          namespace: "flux-system", // Kustomizations live in flux-system
        },
        spec: {
          interval: args.kustomization?.interval || "5m",
          path: args.gitRepository.path,
          prune: args.kustomization?.prune ?? true,
          sourceRef: {
            kind: "GitRepository",
            name: args.gitRepository.name,
            namespace: "flux-system",
          },
          targetNamespace: args.kustomization?.targetNamespace || args.namespace,
          ...(args.kustomization?.dependsOn && {
            dependsOn: args.kustomization.dependsOn.map(dep => ({
              name: dep,
            })),
          }),
        },
      },
      {
        parent: this,
        provider: args.kubernetesProvider,
        dependsOn: [this.namespace],
      }
    );

    this.registerOutputs({
      namespaceName: this.namespace.metadata.name,
      kustomizationName: this.kustomization.metadata.name,
    });
  }
}