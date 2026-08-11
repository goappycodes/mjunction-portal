'use client';

import { useActionState } from 'react';
import { createCampaign, type ActionState } from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Input, Label } from '@/components/ui/primitives';
import { FormSearchableSelect } from '@/components/ui/form-searchable-select';
import type { Language } from '@/lib/database.types';

export function NewCampaignForm({ languages }: { languages: Language[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCampaign,
    {},
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="calling_from">Calling From (brand)</Label>
            <Input id="calling_from" name="calling_from" required placeholder="e.g. Tata Steel Dealer Rewards" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order_reference">Order reference</Label>
            <Input id="order_reference" name="order_reference" placeholder="ORD-..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default_language">Default language</Label>
            <FormSearchableSelect
              id="default_language"
              name="default_language"
              defaultValue="hi"
              searchPlaceholder="Search languages…"
              options={languages.map((l) => ({ value: l.code, label: l.display_name }))}
            />
            <p className="text-xs text-[var(--muted)]">
              Fallback when the recipient gives no input. Default map is 1=Hindi, 2=English.
            </p>
          </div>
          {state.error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="submit" loading={pending}>
              {pending ? 'Creating…' : 'Create campaign'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
