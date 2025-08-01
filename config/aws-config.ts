// config/aws-config.ts
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config("aws");
const stack = pulumi.getStack();

type ValidStack = 'dev' | 'staging' | 'prod';

// Define the configuration type
interface AwsStackConfig {
    region: aws.Region;
    profile: string;
    roleArn: string;
    accountId: string;
}


const awsConfigs: Record<ValidStack, AwsStackConfig> = {
    dev: {
        region: aws.Region.APSoutheast1,
        profile: config.get("dev-profile")!.toString(),
        roleArn: "arn:aws:iam::123456789012:role/PulumiDeploymentRole",
        accountId: "123456789012"
    },
    staging: {
        region: aws.Region.USWest1,
        profile: config.get("staging-profile")!.toString(), 
        roleArn: "arn:aws:iam::123456789012:role/PulumiDeploymentRole-Staging",
        accountId: "123456789012",
    },
    prod: {
        region: aws.Region.USEast1,
        profile: config.get("prod-profile")!.toString(),
        roleArn: "arn:aws:iam::456789012345:role/PulumiDeploymentRole-Prod",
        accountId: "456789012345",
    }
};

function getStackConfig(stackName: string): AwsStackConfig {
    if (!(stackName in awsConfigs)) {
        throw new Error(`Invalid stack: ${stackName}. Valid stacks are: ${Object.keys(awsConfigs).join(', ')}`);
    }
    return awsConfigs[stackName as ValidStack];
}

const currentConfig = getStackConfig(stack);

export const awsProvider = new aws.Provider("aws", {
    region: currentConfig.region,
    profile: currentConfig.profile,
    assumeRole: {
        roleArn: currentConfig.roleArn,
        sessionName: `pulumi-${stack}-${Date.now()}`,
    },
});

export const awsConfig = currentConfig;