import { test, expect } from 'bun:test';
import { createSignal } from 'solid-js';
import { render, fireEvent } from '@solidjs/testing-library';
import MultiChoiceInput from './MultiChoiceInput';

test('MultiChoiceInput emits onChange with toggled values', () => {
  const calls: Array<{ values: string[] }> = [];
  const [value, setValue] = createSignal<{ values: string[] } | undefined>(undefined);
  const { getByLabelText } = render(() => (
    <MultiChoiceInput
      prompt="Pick any"
      options={['A', 'B', 'C']}
      value={value()}
      onChange={(v) => {
        calls.push(v);
        setValue(v);
      }}
    />
  ));
  fireEvent.click(getByLabelText('A'));
  fireEvent.click(getByLabelText('C'));
  expect(calls[calls.length - 1]).toEqual({ values: ['A', 'C'] });
});

test('MultiChoiceInput respects maxSelections', () => {
  const calls: Array<{ values: string[] }> = [];
  const [value, setValue] = createSignal<{ values: string[] } | undefined>({ values: ['A'] });
  const { getByLabelText } = render(() => (
    <MultiChoiceInput
      prompt="Pick any"
      options={['A', 'B', 'C']}
      maxSelections={1}
      value={value()}
      onChange={(v) => {
        calls.push(v);
        setValue(v);
      }}
    />
  ));
  fireEvent.click(getByLabelText('B'));
  // B should NOT have been added (max=1 already reached with A)
  expect(calls).toHaveLength(0);
});
