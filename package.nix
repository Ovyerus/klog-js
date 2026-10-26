{
  lib,
  stdenv,
  nodejs,
  pnpm_10,
  fetchPnpmDeps,
  pnpmConfigHook,
}: let
  packageJSON = builtins.fromJSON (builtins.readFile ./package.json);
in
  stdenv.mkDerivation (finalAttrs: {
    pname = packageJSON.name;
    version = packageJSON.version;

    src = lib.cleanSource ./.;

    pnpmDeps = fetchPnpmDeps {
      inherit (finalAttrs) pname version src;
      pnpm = pnpm_10;
      fetcherVersion = 5;
      hash = "sha256-BlxyaIw4mDVawGSTQg205UN8OdAiX43QRdpIxIylmqo=";
    };

    nativeBuildInputs = [nodejs pnpm_10 pnpmConfigHook];

    buildPhase = ''
      runHook preBuild

      pnpm build

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p $out
      cp -r {dist,package.json,LICENSE,README.md} $out/

      runHook postInstall
    '';
  })
