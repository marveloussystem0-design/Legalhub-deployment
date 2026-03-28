export type DraftFieldDefinition<TFieldKey extends string = string> = {
  key: TFieldKey;
  label: string;
};

export type DraftTemplateDefinition<TFieldKey extends string = string> = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  content: string;
  tier?: 'minimal' | 'premium';
  fields: readonly DraftFieldDefinition<TFieldKey>[];
};
