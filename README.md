# PandeVITA Keycloak Self registration

This application is generated using [LoopBack 4 CLI](https://loopback.io/doc/en/lb4/Command-line-interface.html).

## Usage

The following environment variables must be set (locally or for Docker run):

| Environment Variable Name 	| Default Value                                	|
|---------------------------	|----------------------------------------------	|
| KEYCLOAK_BASE_PATH        	| https://keycloak.pandevita.d.lst.tfo.upm.es/ 	|
| PANDEVITA_REALM           	| pandevita                                    	|
| PANDEVITA_REALM_USER      	|                                              	|
| PANDEVITA_REALM_PASS      	|                                              	|

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

## Authors and history

- Guillermo Mejías ([gmejias@lst.tfo.upm.es](https://gitlab.lst.tfo.upm.es/gmejias))
