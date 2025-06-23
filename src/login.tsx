import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken, setCurrentUser, setCurrentBase } from "@/lib/auth";

export default function LoginPage() {
  const { subdomain } = useParams();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(!subdomain);
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const url = isSuperAdmin 
        ? "/api/super-admin/login"
        : `/api/base/${subdomain}/login`;
      
      const response = await apiRequest("POST", url, credentials);
      return response.json();
    },
    onSuccess: (data) => {
      if (isSuperAdmin) {
        setLocation("/super-admin");
      } else {
        setAuthToken(data.sessionToken);
        setCurrentUser(data.user);
        setCurrentBase(data.base);
        setLocation(`/base/${subdomain}`);
      }
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
    },
    onError: () => {
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-database text-white"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold">NocoBase</h1>
              {subdomain && (
                <p className="text-sm text-gray-500">{subdomain}.nocobase.com</p>
              )}
            </div>
          </div>
          <CardTitle>
            {isSuperAdmin ? "Super Admin Login" : `Login to ${subdomain || "Base"}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            
            {!subdomain && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="superAdmin"
                  checked={isSuperAdmin}
                  onChange={(e) => setIsSuperAdmin(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="superAdmin" className="text-sm">
                  Login as Super Admin
                </Label>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {isSuperAdmin && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Demo Credentials:</strong><br />
                Email: admin@nocobase.com<br />
                Password: admin123
              </p>
            </div>
          )}

          {subdomain && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Demo Credentials:</strong><br />
                Email: sarah@acme-corp.com<br />
                Password: password123
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
