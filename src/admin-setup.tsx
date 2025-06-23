import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const setupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SetupForm = z.infer<typeof setupSchema>;

export default function AdminSetup() {
  const [match, params] = useRoute('/admin-setup/:token');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [magicLinkData, setMagicLinkData] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: '',
      password: '',
      confirmPassword: ''
    }
  });

  useEffect(() => {
    const validateMagicLink = async () => {
      if (!params?.token) {
        setError('Invalid magic link');
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/magic-link/${params.token}`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Invalid magic link');
          setIsValidating(false);
          return;
        }

        const data = await response.json();
        console.log('Magic link validation successful:', data);
        setMagicLinkData(data);
        setIsValidating(false);
      } catch (err) {
        console.error('Magic link validation error:', err);
        setError('Failed to validate magic link');
        setIsValidating(false);
      }
    };

    validateMagicLink();
  }, [params?.token]);

  const onSubmit = async (data: SetupForm) => {
    if (!params?.token) return;

    setIsSettingUp(true);
    try {
      const response = await fetch('/api/admin-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: params.token,
          name: data.name,
          password: data.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Setup failed');
      }

      const result = await response.json();
      
      // Store authentication data
      localStorage.setItem('sessionToken', result.sessionToken);
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      localStorage.setItem('currentBase', JSON.stringify({ id: result.baseId }));

      toast({
        title: "Account Setup Complete",
        description: "Your admin account has been created. Please log in to continue.",
      });

      // Redirect to login page for the base
      const baseName = magicLinkData?.base?.name?.toLowerCase() || 'base';
      setLocation(`/login/${baseName}`);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSettingUp(false);
    }
  };

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Invalid Link</CardTitle>
            <CardDescription className="text-center">
              This admin setup link is not valid.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Validating setup link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 mr-2" />
              Setup Failed
            </CardTitle>
            <CardDescription className="text-center">
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
            Complete Your Setup
          </CardTitle>
          <CardDescription className="text-center">
            Welcome to <strong>{magicLinkData?.base?.name}</strong>
            <br />
            Setting up admin account for: <strong>{magicLinkData?.adminEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter your full name"
                className="mt-1"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register('password')}
                placeholder="Create a secure password"
                className="mt-1"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...form.register('confirmPassword')}
                placeholder="Confirm your password"
                className="mt-1"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-600">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSettingUp}
            >
              {isSettingUp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Setting up account...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}