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
      <p class="font-display font-medium text-3xl md:text-4xl leading-snug text-ink mb-6">
        {props.prompt}
      </p>
      <div role="radiogroup" class="space-y-1">
        <For each={props.options}>
          {(opt) => (
            <label class="choice-label">
              <input
                type="radio"
                name="single-choice"
                value={opt}
                checked={selected() === opt}
                onChange={() => pick(opt)}
                class="choice-input-hidden"
              />
              <span class={`choice-box${selected() === opt ? ' choice-box-checked' : ''}`} />
              <span>{opt}</span>
            </label>
          )}
        </For>
        <Show when={props.allowOther}>
          <label class="choice-label">
            <input
              type="radio"
              name="single-choice"
              value={OTHER}
              checked={selected() === OTHER}
              onChange={() => pick(OTHER)}
              class="choice-input-hidden"
            />
            <span class={`choice-box${selected() === OTHER ? ' choice-box-checked' : ''}`} />
            <span>Other</span>
          </label>
          <Show when={selected() === OTHER}>
            <span class="input-underline-wrap block mt-3 ml-6">
              <input
                type="text"
                class="text-input-editorial text-xl"
                value={otherText()}
                placeholder="Please specify…"
                onInput={(e) => updateOther(e.currentTarget.value)}
              />
            </span>
          </Show>
        </Show>
      </div>
    </div>
  );
}
