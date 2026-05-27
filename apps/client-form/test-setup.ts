import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();

// Bun plugin to transform .tsx files with babel-preset-solid for correct JSX handling
import { plugin } from 'bun';
import * as babel from '@babel/core';
import solidPreset from 'babel-preset-solid';
import tsPreset from '@babel/preset-typescript';
import { readFileSync } from 'fs';

plugin({
  name: 'solid-jsx-transform',
  setup(build) {
    build.onLoad({ filter: /\.(tsx|jsx)$/ }, async (args) => {
      const source = readFileSync(args.path, 'utf-8');
      const result = await babel.transformAsync(source, {
        filename: args.path,
        presets: [
          [tsPreset, { allExtensions: true, isTSX: true }],
          solidPreset,
        ],
      });
      return {
        contents: result?.code ?? source,
        loader: 'js',
      };
    });
  },
});
