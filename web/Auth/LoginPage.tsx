import { useState, type FormEvent } from 'react';
import { AlertCircleIcon, BoxIcon, Loader2Icon } from 'lucide-react';
import type { MeResponse } from '../../shared/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '../apiClient';

/** Schlüssel für den zuletzt verwendeten Namen im localStorage */
const LAST_NAME_KEY = 'druckwunsch:lastName';

interface Props {
  onLoggedIn: (me: MeResponse) => void;
}

export function LoginPage({ onLoggedIn }: Props) {
  const [name, setName] = useState(() => readLastName());
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const me = await login({ name, code });
      writeLastName(name);
      onLoggedIn(me);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BoxIcon className="size-6" />
          </div>
          <CardTitle className="text-xl">Druckwunsch</CardTitle>
          <CardDescription>Wünsch dir ein Modell von MakerWorld, ich drucke es für dich.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="login-name">Dein Name</Label>
              <Input
                id="login-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="nickname"
                placeholder="z.B. Oma"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-code">Familien-Code</Label>
              <Input
                id="login-code"
                type="password"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error !== null && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function readLastName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastName(name: string): void {
  try {
    localStorage.setItem(LAST_NAME_KEY, name.trim());
  } catch {
    // Ohne localStorage muss der Name beim nächsten Mal eben neu eingegeben werden.
  }
}
