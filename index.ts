// index.ts - Keep this clean and simple
import * as pulumi from "@pulumi/pulumi";
import { environmentConfig } from "./config/environments"
import {NetworkingStack} from "./modules/networking"
import {KubernetesStack} from "./modules/k8s"
import {FluxCDComponent, FluxApp} from "./modules/components/flux-cd"

const stack = pulumi.getStack();
const config = new pulumi.Config();

// Create networking infrastructure
const networking = new NetworkingStack(`${stack}-networking`, {
    config: environmentConfig.vpc,
});

// Create Kubernetes cluster
const kubernetes = new KubernetesStack(`${stack}-k8s`, {
    vpcId: networking.vpc.id,
    subnetIds: networking.publicSubnets.map(s => s.id),
    config: environmentConfig.eks,
});

const fluxCD = new FluxCDComponent(`${stack}-flux`, {
    kubernetesProvider: kubernetes.provider,
    cluster: kubernetes.cluster,
    gitRepositories: [{
        name: 'example-app-1',
        url: 'https://github.com/ducmanh79/flux-cd-test',
        branch: 'flux-cd',
        secretRef: 'app1-git-token', 
        path: "./flux-cd-test-app-1/deploy"
    }]
});

// Create GitHub credentials for private repositories
const githubCreds = fluxCD.createGitCredentials("app1-git-token", {
    type: "token",
    token: config.requireSecret("github-token"),
}, kubernetes.provider);

// Create individual FluxCD applications
const app1 = new FluxApp(`${stack}-app1`, {
    kubernetesProvider: kubernetes.provider,
    name: "example-app-1",
    namespace: "app1-namespace",
    gitRepository: {
        name: "example-app-1", // References the GitRepository created above
        path: "./flux-cd-test-app-1/deploy",
    },
    kustomization: {
        interval: "5m",
        prune: true,
    },
});

// // You can create more apps that reference the same GitRepository
// const app2 = new FluxApp(`${stack}-app2`, {
//     kubernetesProvider: kubernetes.provider,
//     name: "example-app-2", 
//     namespace: "app2-namespace",
//     gitRepository: {
//         name: "example-app-1", // Same repo, different path
//         path: "./flux-cd-test-app-2/deploy",
//     },
//     kustomization: {
//         interval: "10m",
//         prune: true,
//         dependsOn: ["example-app-1"], // Deploy after app1
//     },
// });

// Export important outputs
export const vpcId = networking.vpc.id;
export const clusterName = kubernetes.cluster.eksCluster.name;
export const clusterEndpoint = kubernetes.cluster.eksCluster.endpoint;
export const kubeconfig = kubernetes.cluster.kubeconfig;
export const fluxNamespace = fluxCD.namespace.metadata.name;