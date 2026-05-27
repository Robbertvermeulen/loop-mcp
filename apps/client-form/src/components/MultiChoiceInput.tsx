import { createSignal, For } from 'solid-js';

interface MultiChoiceInputProps {
  prompt: string;
  options: string[];
  minSelections?: number;
  maxSelections?: number;
  value?: { values: string[] };
  onChange: (v: { values: string[] }) => void;
}

export default function MultiChoiceInput(props: MultiChoiceInputProps) {
  const [internal, setInternal] = createSignal<string[]>(props.value?.values ?? []);
  const values = () => props.value?.values ?? internal();

  function toggle(option: string) {
    const current = values();
    if (current.includes(option)) {
      const next = current.filter((v) => v !== option);
      setInternal(next);
      props.onChange({ values: next });
    } else {
      if (props.maxSelections !== undefined && current.length >= props.maxSelections) return;
      const next = [...current, option];
      setInternal(next);
      props.onChange({ values: next });
    }
  }

  return (
    <div>
      <p class="font-display font-medium text-3xl md:text-4xl leading-snug text-ink mb-6">
        {props.prompt}
      </p>
      <div class="space-y-1">
        <For each={props.options}>
          {(opt) => {
            const checked = () => values().includes(opt);
            return (
              <label class="choice-label">
                <input
                  type="checkbox"
                  checked={checked()}
                  onChange={() => toggle(opt)}
                  class="choice-input-hidden"
                />
                <span
                  class={`choice-box${checked() ? ' choice-box-checked choice-box-check' : ''}`}
                  style={{ width: '14px', height: '14px' }}
                />
                <span>{opt}</span>
              </label>
            );
          }}
        </For>
      </div>
    </div>
  );
}
