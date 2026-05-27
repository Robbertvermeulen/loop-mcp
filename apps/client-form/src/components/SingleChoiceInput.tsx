import { createSignal, For, Show } from 'solid-js';

interface SingleChoiceInputProps {
  prompt: string;
  options: string[];
  allowOther?: boolean;
  value?: { value: string; other?: string };
  onChange: (v: { value: string; other?: string }) => void;
}

const OTHER = '__other__';

export default function SingleChoiceInput(props: SingleChoiceInputProps) {
  const [otherText, setOtherText] = createSignal(props.value?.other ?? '');
  const [internalSelected, setInternalSelected] = createSignal(props.value?.value);
  const selected = () => props.value?.value ?? internalSelected();

  function pick(v: string) {
    setInternalSelected(v);
    if (v === OTHER) {
      props.onChange({ value: OTHER, other: otherText() });
    } else {
      props.onChange({ value: v });
    }
  }

  function updateOther(t: string) {
    setOtherText(t);
    props.onChange({ value: OTHER, other: t });
  }

  return (
    <div>
      <p>{props.prompt}</p>
      <div role="radiogroup">
        <For each={props.options}>
          {(opt) => (
            <label>
              <input
                type="radio"
                name="single-choice"
                value={opt}
                checked={selected() === opt}
                onChange={() => pick(opt)}
              />
              <span>{opt}</span>
            </label>
          )}
        </For>
        <Show when={props.allowOther}>
          <label>
            <input
              type="radio"
              name="single-choice"
              value={OTHER}
              checked={selected() === OTHER}
              onChange={() => pick(OTHER)}
            />
            <span>Other</span>
          </label>
          <Show when={selected() === OTHER}>
            <input
              type="text"
              value={otherText()}
              onInput={(e) => updateOther(e.currentTarget.value)}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
}
