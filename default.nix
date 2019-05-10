#node2nix -8 -i package.json  -l ./package-lock.json --supplement-input node-packages.json
#nix-build override.nix -A package --verbose --show-trace
{ pkgs ? import <nixpkgs> {}
, system ? builtins.currentSystem
}:

let
  nodePackages = import ./n3h.nix {
    inherit pkgs system;
  };
  nodeEnv = import ./node-env.nix { inherit pkgs system; };
in

nodePackages // {
  package = nodePackages.package.override(oldAttrs: {
    buildInputs = oldAttrs.buildInputs ++  [ 
      pkgs.openssl.dev 
      pkgs.openssl.out 
      pkgs.clang 
      pkgs.libtool 
      pkgs.autoconf 
      pkgs.automake 
    ];
  });
}
