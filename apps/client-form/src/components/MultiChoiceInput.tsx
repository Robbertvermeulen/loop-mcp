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
      <p>{props.prompt}</p>
      <div>
        <For each={props.options}>
          {(opt) => (
            <label>
              <input
                type="checkbox"
                checked={values().includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          )}
        </For>
      </div>
    </div>
  );
}
