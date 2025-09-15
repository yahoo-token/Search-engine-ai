import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Globe, Plus, CheckCircle, XCircle, Loader2 } from "lucide-react";
import SearchHeader from "@/components/search-header";

const submitWebsiteSchema = z.object({
  url: z.string()
    .url("Please enter a valid URL (e.g., https://example.com)")
    .min(1, "URL is required"),
  category: z.enum(["companies", "shopping", "news", "saas", "cloud", "web3"], {
    required_error: "Please select a category"
  })
});

type SubmitWebsiteFormData = z.infer<typeof submitWebsiteSchema>;

interface SubmissionResult {
  success: boolean;
  message: string;
  domainId?: string;
  queuedUrls?: number;
}

export default function SubmitWebsitePage() {
  const { toast } = useToast();
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  const form = useForm<SubmitWebsiteFormData>({
    resolver: zodResolver(submitWebsiteSchema),
    defaultValues: {
      url: "",
      category: undefined
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitWebsiteFormData) => {
      const res = await apiRequest("POST", "/api/submit-website", data);
      return await res.json();
    },
    onSuccess: (data: SubmissionResult) => {
      setSubmissionResult(data);
      if (data.success) {
        toast({
          title: "Website Submitted Successfully!",
          description: `Your website has been added to our crawl queue. We'll begin indexing it shortly.`,
        });
        form.reset();
      } else {
        toast({
          title: "Submission Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: SubmitWebsiteFormData) => {
    setSubmissionResult(null);
    submitMutation.mutate(data);
  };

  const handleSearch = () => {
    // Placeholder for search functionality
  };

  return (
    <div className="min-h-screen bg-background">
      <SearchHeader onSearch={handleSearch} />
      
      <main className="pt-32 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="text-primary-foreground text-2xl" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Submit Your Website</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Add your website to YAS search engine. Our intelligent crawler will automatically index 
              all your pages and extract comprehensive metadata.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Submission Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Website Information
                  </CardTitle>
                  <CardDescription>
                    Tell us about your website so we can categorize and index it properly.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* URL Field */}
                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website URL *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://yourwebsite.com"
                                data-testid="input-website-url"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Enter the main URL of your website. We'll automatically discover and crawl all linked pages.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category Field */}
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-category">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="companies">Companies</SelectItem>
                                <SelectItem value="shopping">Shopping</SelectItem>
                                <SelectItem value="news">News</SelectItem>
                                <SelectItem value="saas">SaaS</SelectItem>
                                <SelectItem value="cloud">Cloud</SelectItem>
                                <SelectItem value="web3">Web3</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose the category that best describes your website's primary focus.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Submit Button */}
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={submitMutation.isPending}
                        data-testid="button-submit-website"
                      >
                        {submitMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting Website...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Submit Website for Indexing
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Submission Result */}
              {submissionResult && (
                <Alert className={`mt-6 ${submissionResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    {submissionResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={submissionResult.success ? 'text-green-800' : 'text-red-800'}>
                      {submissionResult.message}
                      {submissionResult.success && submissionResult.queuedUrls && (
                        <span className="block mt-1">
                          {submissionResult.queuedUrls} URLs have been queued for crawling.
                        </span>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>

            {/* Information Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground text-sm font-bold">1</div>
                    <div>
                      <p className="font-semibold">Submit Your URL</p>
                      <p className="text-sm text-muted-foreground">Provide your website URL and basic information</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground text-sm font-bold">2</div>
                    <div>
                      <p className="font-semibold">Automatic Discovery</p>
                      <p className="text-sm text-muted-foreground">Our crawler discovers all linked pages and directories</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground text-sm font-bold">3</div>
                    <div>
                      <p className="font-semibold">Metadata Extraction</p>
                      <p className="text-sm text-muted-foreground">Extract titles, descriptions, and content for search</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground text-sm font-bold">4</div>
                    <div>
                      <p className="font-semibold">Live in Search</p>
                      <p className="text-sm text-muted-foreground">Your website appears in YAS search results</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>• Submit only websites you own or have permission to index</p>
                  <p>• Ensure your website has public content (not password protected)</p>
                  <p>• Add a robots.txt file to control what gets crawled</p>
                  <p>• Use descriptive page titles and meta descriptions</p>
                  <p>• Processing typically takes 1-24 hours depending on site size</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}