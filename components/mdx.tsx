import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import { InExplorer } from '@/components/in-explorer';
import { NextLegend, NextMark, NextVersion, Since } from '@/components/next-version';
import { Shot, ShotRow } from '@/components/shot';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Step,
    Steps,
    Shot,
    ShotRow,
    InExplorer,
    NextVersion,
    Since,
    NextMark,
    NextLegend,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
