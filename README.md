# Gravitate-Health Keycloak Self registration

This application is generated using [LoopBack 4 CLI](https://loopback.io/doc/en/lb4/Command-line-interface.html).

## Usage

The following environment variables must be set (locally or for Docker run):

| Environment Variable Name 	| Default Value                                	|
|---------------------------	|----------------------------------------------	|
| KEYCLOAK_BASE_PATH        	| https://fosps.gravitatehealth.eu             	|
| KEYCLOAK_REALM            	| GravitateHealth                              	|
| SERVICE_USERNAME          	|                                              	|
| SERVICE_PASSWORD          	|                                              	|

## Run locally

```sh
npm install
npm start
```

## Docker

Build the image: 
```bash
docker build . -t IMAGE_NAME:IMAGE_TAG
```

To run the image:
```bash
docker run IMAGE_NAME:IMAGE_TAG
```

## Deployment

### Deploy via Helm (OCI)

```bash
# Login to registry (if private)
helm registry login ghcr.io

# Deploy directly from the registry
helm install my-release oci://ghcr.io/<your-org>/charts/keycloak-registration --version <version>
```

### Local Development

```bash
helm lint charts/keycloak-registration
helm template my-release charts/keycloak-registration
```

## Authors and history

- Guillermo Mejías ([gmejias@lst.tfo.upm.es](https://gitlab.lst.tfo.upm.es/gmejias))
