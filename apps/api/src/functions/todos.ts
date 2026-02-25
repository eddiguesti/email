/**
 * Todos API Endpoints
 *
 * Task management for lawyers - create, update, delete todos.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createClient } from '@supabase/supabase-js';
import {
  getUserIdFromRequest,
  errorResponse,
  successResponse,
  isValidUUID,
} from '../utils/auth.js';
import { validateTodoInput, isValidUUID as validateUUID } from '../utils/validation.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Todo {
  id?: string;
  lawyer_id: string;
  email_message_id?: string;
  email_subject?: string;
  email_sender?: string;
  email_received_at?: string;
  dossier_id?: string;
  dossier_name?: string;
  dossier_rg?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * GET /api/todos - List todos for current user
 */
async function getTodos(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse(401, 'Non authentifié');
  }

  try {
    const status = request.query.get('status');
    const limitParam = request.query.get('limit');
    const offsetParam = request.query.get('offset');

    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

    // Validate status if provided
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return errorResponse(400, `Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`);
    }

    let query = supabase
      .from('todos')
      .select('*', { count: 'exact' })
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: todos, error, count } = await query;

    if (error) {
      context.error('Database error fetching todos:', error);
      throw error;
    }

    return successResponse({
      todos: todos || [],
      total: count || todos?.length || 0,
      limit,
      offset,
    });
  } catch (error) {
    context.error('Error fetching todos:', error);
    return errorResponse(500, 'Erreur lors de la récupération des tâches');
  }
}

/**
 * POST /api/todos - Create a new todo
 */
async function createTodo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse(401, 'Non authentifié');
  }

  try {
    const body = await request.json();
    const validation = validateTodoInput(body);

    if (!validation.valid) {
      return errorResponse(400, validation.errors.join(', '));
    }

    const newTodo: Partial<Todo> = {
      lawyer_id: userId,
      title: validation.data.title,
      description: validation.data.description,
      status: validation.data.status || 'pending',
      priority: validation.data.priority || 'normal',
      due_date: validation.data.due_date,
      email_message_id: validation.data.email_message_id,
      email_subject: validation.data.email_subject,
      email_sender: validation.data.email_sender,
      email_received_at: validation.data.email_received_at,
      dossier_id: validation.data.dossier_id,
      dossier_name: validation.data.dossier_name,
      dossier_rg: validation.data.dossier_rg,
    };

    const { data: todo, error } = await supabase
      .from('todos')
      .insert(newTodo)
      .select()
      .single();

    if (error) {
      context.error('Database error creating todo:', error);
      throw error;
    }

    context.log(`Created todo ${todo.id} for user ${userId}`);

    return successResponse({ todo }, 201);
  } catch (error) {
    context.error('Error creating todo:', error);
    return errorResponse(500, 'Erreur lors de la création de la tâche');
  }
}

/**
 * PATCH /api/todos/{id} - Update a todo
 */
async function updateTodo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse(401, 'Non authentifié');
  }

  const todoId = request.params.id;
  if (!todoId) {
    return errorResponse(400, 'ID de tâche requis');
  }

  // Validate UUID format to prevent injection
  if (!isValidUUID(todoId)) {
    return errorResponse(400, 'ID de tâche invalide');
  }

  try {
    const body = await request.json() as Partial<Todo>;

    // Build update object with validation
    const updates: Partial<Todo> = {};
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    const validPriorities = ['low', 'normal', 'high', 'urgent'];

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.length > 500) {
        return errorResponse(400, 'Titre invalide (max 500 caractères)');
      }
      updates.title = body.title.trim();
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length > 10000) {
        return errorResponse(400, 'Description invalide (max 10000 caractères)');
      }
      updates.description = body.description;
    }

    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return errorResponse(400, `Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`);
      }
      updates.status = body.status;
      if (body.status === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = undefined;
      }
    }

    if (body.priority !== undefined) {
      if (!validPriorities.includes(body.priority)) {
        return errorResponse(400, `Priorité invalide. Valeurs acceptées: ${validPriorities.join(', ')}`);
      }
      updates.priority = body.priority;
    }

    if (body.due_date !== undefined) {
      if (body.due_date !== null && isNaN(Date.parse(body.due_date))) {
        return errorResponse(400, 'Date d\'échéance invalide');
      }
      updates.due_date = body.due_date;
    }

    if (body.dossier_id !== undefined) updates.dossier_id = body.dossier_id;
    if (body.dossier_name !== undefined) updates.dossier_name = body.dossier_name;
    if (body.dossier_rg !== undefined) updates.dossier_rg = body.dossier_rg;

    if (Object.keys(updates).length === 0) {
      return errorResponse(400, 'Aucune modification fournie');
    }

    const { data: todo, error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', todoId)
      .eq('lawyer_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse(404, 'Tâche non trouvée');
      }
      context.error('Database error updating todo:', error);
      throw error;
    }

    context.log(`Updated todo ${todoId} for user ${userId}`);

    return successResponse({ todo });
  } catch (error) {
    context.error('Error updating todo:', error);
    return errorResponse(500, 'Erreur lors de la mise à jour de la tâche');
  }
}

/**
 * DELETE /api/todos/{id} - Delete a todo
 */
async function deleteTodo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse(401, 'Non authentifié');
  }

  const todoId = request.params.id;
  if (!todoId) {
    return errorResponse(400, 'ID de tâche requis');
  }

  // Validate UUID format
  if (!isValidUUID(todoId)) {
    return errorResponse(400, 'ID de tâche invalide');
  }

  try {
    // First check if the todo exists and belongs to user
    const { data: existing } = await supabase
      .from('todos')
      .select('id')
      .eq('id', todoId)
      .eq('lawyer_id', userId)
      .single();

    if (!existing) {
      return errorResponse(404, 'Tâche non trouvée');
    }

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', todoId)
      .eq('lawyer_id', userId);

    if (error) {
      context.error('Database error deleting todo:', error);
      throw error;
    }

    context.log(`Deleted todo ${todoId} for user ${userId}`);

    return successResponse({ success: true });
  } catch (error) {
    context.error('Error deleting todo:', error);
    return errorResponse(500, 'Erreur lors de la suppression de la tâche');
  }
}

// Register endpoints
app.http('todos-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'todos',
  handler: getTodos,
});

app.http('todos-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'todos',
  handler: createTodo,
});

app.http('todos-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'todos/{id}',
  handler: updateTodo,
});

app.http('todos-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'todos/{id}',
  handler: deleteTodo,
});
