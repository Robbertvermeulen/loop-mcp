import { Match, Switch } from 'solid-js';
import type { Question, Answer } from '../types';
import TextShortInput from './TextShortInput';
import TextLongInput from './TextLongInput';
import SingleChoiceInput from './SingleChoiceInput';
import MultiChoiceInput from './MultiChoiceInput';

interface QuestionRendererProps {
  question: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  autofocus?: boolean;
}

export default function QuestionRenderer(props: QuestionRendererProps) {
  return (
    <Switch>
      <Match when={props.question.type === 'text_short'}>
        <TextShortInput
          prompt={props.question.prompt}
          placeholder={(props.question as Extract<Question, { type: 'text_short' }>).placeholder}
          value={(props.value as string) ?? ''}
          autofocus={props.autofocus}
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={props.question.type === 'text_long'}>
        <TextLongInput
          prompt={props.question.prompt}
          placeholder={(props.question as Extract<Question, { type: 'text_long' }>).placeholder}
          value={(props.value as string) ?? ''}
          autofocus={props.autofocus}
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={props.question.type === 'single_choice'}>
        {(() => {
          const q = props.question as Extract<Question, { type: 'single_choice' }>;
          return (
            <SingleChoiceInput
              prompt={q.prompt}
              options={q.options}
              allowOther={q.allowOther}
              value={props.value as { value: string; other?: string } | undefined}
              onChange={(v) => props.onChange(v)}
            />
          );
        })()}
      </Match>
      <Match when={props.question.type === 'multi_choice'}>
        {(() => {
          const q = props.question as Extract<Question, { type: 'multi_choice' }>;
          return (
            <MultiChoiceInput
              prompt={q.prompt}
              options={q.options}
              minSelections={q.minSelections}
              maxSelections={q.maxSelections}
              value={props.value as { values: string[] } | undefined}
              onChange={(v) => props.onChange(v)}
            />
          );
        })()}
      </Match>
    </Switch>
  );
}
