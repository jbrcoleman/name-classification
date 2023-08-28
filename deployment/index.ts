import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

const name = "test-cluster";

// Create an EKS cluster with non-default configuration
const vpc = new awsx.ec2.Vpc("vpc", { numberOfAvailabilityZones: 2 });

const cluster = new eks.Cluster(name, {
    vpcId: vpc.vpcId,
    subnetIds: vpc.publicSubnetIds,
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 2,
    storageClasses: "gp2",
    deployDashboard: false,
});

// Export the clusters' kubeconfig.
export const kubeconfig = cluster.kubeconfig;

// Create a Kubernetes Namespace
const ns = new k8s.core.v1.Namespace(name, {}, { provider: cluster.provider });

// Export the Namespace name
export const namespaceName = ns.metadata.apply(m => m.name);

// Create a app Deployment
const appLabels = { appClass: name };
const deployment = new k8s.apps.v1.Deployment(name,
    {
        metadata: {
            namespace: namespaceName,
            labels: appLabels,
        },
        spec: {
            replicas: 1,
            selector: { matchLabels: appLabels },
            template: {
                metadata: {
                    labels: appLabels,
                },
                spec: {
                    containers: [
                        {
                            name: name,
                            image: "bravinwasike/streamlitapp",
                            ports: [{ containerPort: 8501, }]
                        }
                    ],
                }
            }
        },
    },
    {
        provider: cluster.provider,
    }
);

// Export the Deployment name
export const deploymentName = deployment.metadata.apply(m => m.name);

// Create a LoadBalancer Service for the app Deployment
const service = new k8s.core.v1.Service(name,
    {
        metadata: {
            labels: appLabels,
            namespace: namespaceName,
        },
        spec: {
            type: "LoadBalancer",
            ports: [{ port: 80, targetPort: 8501 }],
            selector: appLabels,
        },
    },
    {
        provider: cluster.provider,
    }
);

// Export the Service name and public LoadBalancer Endpoint
export const serviceName = service.metadata.apply(m => m.name);
export const serviceHostname = service.status.apply(s => s.loadBalancer.ingress[0].hostname)