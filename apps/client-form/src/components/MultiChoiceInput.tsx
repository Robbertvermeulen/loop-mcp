import { For } from 'solid-js';

interface MultiChoiceInputProps {
  prompt: string;
  options: string[];
  minSelections?: number;
  maxSelections?: number;
  value?: { values: string[] };
  onChange: (v: { values: string[] }) => void;
}

export default function MultiChoiceInput(props: MultiChoiceInputProps) {
  const values = () => props.value?.values ?? [];

  function toggle(option: string) {
    const current = values();
    if (current.includes(option)) {
      props.onChange({ values: current.filter((v) => v !== option) });
    } else {
      if (props.maxSelections !== undefined && current.length >= props.maxSelections) return;
      props.onChange({ values: [...current, option] });
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
