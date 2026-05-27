interface TextShortInputProps {
  prompt: string;
  value: string;
  placeholder?: string;
  autofocus?: boolean;
  onChange: (v: string) => void;
}

export default function TextShortInput(props: TextShortInputProps) {
  return (
    <div>
      <label class="block">
        <span>{props.prompt}</span>
        <input
          type="text"
          class="w-full"
          value={props.value}
          placeholder={props.placeholder}
          autofocus={props.autofocus}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}
