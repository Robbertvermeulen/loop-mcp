import { test, expect } from 'bun:test';
import { createSignal } from 'solid-js';
import { render, fireEvent } from '@solidjs/testing-library';
import SingleChoiceInput from './SingleChoiceInput';

test('SingleChoiceInput emits onChange with selected option', () => {
  const calls: Array<{ value: string; other?: string }> = [];
  const [value, setValue] = createSignal<{ value: string; other?: string } | undefined>(undefined);
  const { getByLabelText } = render(() => (
    <SingleChoiceInput
      prompt="Pick one"
      options={['Red', 'Blue']}
      value={value()}
      onChange={(v) => {
        calls.push(v);
        setValue(v);
      }}
    />
  ));
  fireEvent.click(getByLabelText('Red'));
  expect(calls).toContainEqual({ value: 'Red' });
});

test('SingleChoiceInput allowOther shows text input only when Other selected', () => {
  const [value, setValue] = createSignal<{ value: string; other?: string } | undefined>(undefined);
  const { getByLabelText, queryByRole } = render(() => (
    <SingleChoiceInput
      prompt="Pick one"
      options={['Red']}
      allowOther
      value={value()}
      onChange={(v) => setValue(v)}
    />
  ));
  // Initially no extra text input
  // (The SingleChoiceInput component has an Other radio label and conditionally renders an extra <input type="text">.)
  expect(queryByRole('textbox')).toBeNull();
  fireEvent.click(getByLabelText('Other'));
  expect(queryByRole('textbox')).not.toBeNull();
});
