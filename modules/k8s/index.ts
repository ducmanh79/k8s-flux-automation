// modules/kubernetes/index.ts
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { awsProvider } from "../../config/aws-config";

export interface KubernetesStackArgs {
    vpcId: pulumi.Input<string>;
    subnetIds: pulumi.Input<string>[];
    config: {
        version: string;
        nodeGroups: {
            workers: {
                instanceTypes: string[];
                minSize: number;
                maxSize: number;
                desiredSize: number;
            }
        }
    };
}

export class KubernetesStack extends pulumi.ComponentResource {
    public readonly cluster: eks.Cluster;
    public readonly provider: k8s.Provider;

    constructor(name: string, args: KubernetesStackArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:kubernetes:KubernetesStack", name, {}, opts);

        const vpc = new awsx.ec2.Vpc(`cluster-2`, {
            tags: { Name: `cluster-2` },
        });

        this.cluster = new eks.Cluster("cluster", {
            vpcId: vpc.vpcId,
            subnetIds: vpc.publicSubnetIds,
            version: args.config.version,
            maxSize: args.config.nodeGroups.workers.maxSize,
            minSize: args.config.nodeGroups.workers.minSize,
            desiredCapacity: args.config.nodeGroups.workers.desiredSize,
            instanceType: args.config.nodeGroups.workers.instanceTypes[0],
        });
        
        this.provider = new k8s.Provider(`${name}-k8s-provider`, {
            kubeconfig: this.cluster.kubeconfig,
        }, { parent: this });

        
        this.registerOutputs({
            clusterName: this.cluster.eksCluster.name,
            clusterEndpoint: this.cluster.eksCluster.endpoint,
            kubeconfig: this.cluster.kubeconfig,
        });
    }
}