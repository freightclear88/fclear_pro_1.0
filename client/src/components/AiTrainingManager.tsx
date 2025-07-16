import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Bot, MessageSquare, Tag, Star } from 'lucide-react';
import type { AiTrainingData } from '@shared/schema';

interface TrainingForm {
  question: string;
  answer: string;
  keywords: string;
  category: string;
  priority: number;
  isActive: boolean;
}

const categories = [
  'general',
  'shipping',
  'customs', 
  'documents',
  'payments',
  'poa',
  'irs',
  'support'
];

export default function AiTrainingManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AiTrainingData | null>(null);
  const [form, setForm] = useState<TrainingForm>({
    question: '',
    answer: '',
    keywords: '',
    category: 'general',
    priority: 1,
    isActive: true
  });

  const { data: trainingData = [], isLoading } = useQuery({
    queryKey: ['/api/admin/ai-training'],
    queryFn: () => apiRequest('/api/admin/ai-training'),
  });

  const createMutation = useMutation({
    mutationFn: async (data: TrainingForm) => {
      const payload = {
        ...data,
        keywords: data.keywords.split(',').map(k => k.trim()).filter(k => k)
      };
      return await apiRequest('/api/admin/ai-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "AI training data created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-training'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TrainingForm }) => {
      const payload = {
        ...data,
        keywords: data.keywords.split(',').map(k => k.trim()).filter(k => k)
      };
      return await apiRequest(`/api/admin/ai-training/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "AI training data updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-training'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/admin/ai-training/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "AI training data deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-training'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({
      question: '',
      answer: '',
      keywords: '',
      category: 'general',
      priority: 1,
      isActive: true
    });
    setEditingItem(null);
  };

  const handleEdit = (item: AiTrainingData) => {
    setEditingItem(item);
    setForm({
      question: item.question,
      answer: item.answer,
      keywords: item.keywords?.join(', ') || '',
      category: item.category || 'general',
      priority: item.priority || 1,
      isActive: item.isActive ?? true
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: "Error", description: "Question and answer are required", variant: "destructive" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this training data?')) {
      deleteMutation.mutate(id);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      shipping: 'bg-blue-100 text-blue-800',
      customs: 'bg-green-100 text-green-800',
      documents: 'bg-purple-100 text-purple-800',
      payments: 'bg-orange-100 text-orange-800',
      poa: 'bg-red-100 text-red-800',
      irs: 'bg-yellow-100 text-yellow-800',
      support: 'bg-gray-100 text-gray-800',
      general: 'bg-indigo-100 text-indigo-800'
    };
    return colors[category] || colors.general;
  };

  if (isLoading) {
    return <div className="p-6">Loading AI training data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-freight-teal" />
          <h2 className="text-2xl font-bold text-freight-dark">AI Chat Training</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Training Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Training Data' : 'Add Training Data'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question/Trigger Phrase</Label>
                <Textarea
                  id="question"
                  value={form.question}
                  onChange={(e) => setForm(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="What question or phrase should trigger this response?"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="answer">AI Response</Label>
                <Textarea
                  id="answer"
                  value={form.answer}
                  onChange={(e) => setForm(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="How should the AI respond to this question?"
                  className="min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={form.category} onValueChange={(value) => setForm(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    value={form.priority}
                    onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={form.keywords}
                  onChange={(e) => setForm(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="shipping, freight, documents, customs..."
                />
                <p className="text-sm text-gray-600">Keywords help match user questions to this response</p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {trainingData.map((item: AiTrainingData) => (
          <Card key={item.id} className={`${!item.isActive ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getCategoryColor(item.category || 'general')}>
                      {item.category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span className="text-sm text-gray-600">Priority {item.priority}</span>
                    </div>
                    {!item.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg font-medium text-freight-dark">
                    {item.question}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(item)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">AI Response:</Label>
                  <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-3 rounded">
                    {item.answer}
                  </p>
                </div>
                {item.keywords && item.keywords.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-4 h-4 text-gray-500" />
                    {item.keywords.map((keyword, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {trainingData.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No training data yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first AI training entry to customize how the chat agent responds to specific questions.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Training Data
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}