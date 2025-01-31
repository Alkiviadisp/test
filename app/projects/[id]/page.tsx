"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Plus, 
  FolderKanban, 
  CalendarDays, 
  Tag, 
  Paperclip, 
  Clock,
  CheckCircle2,
  Circle,
  ArrowLeft,
  MoreVertical,
  Calendar as CalendarIcon,
  Pencil,
  Trash2,
  X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import Link from "next/link"

type ProjectStatus = 'todo' | 'in-progress' | 'done'

type Project = {
  id: string
  title: string
  description: string
  status: "todo" | "in-progress" | "done"
  due_date: string
  priority: "low" | "medium" | "high"
  tags: string[]
  attachments: Array<{
    url: string
    name: string
    type: string
    size: number
    path: string
  }>
  color: string
  created_at: string
}

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: ProjectStatus
  project_id: string
  created_by: string
  created_at: string
  updated_at: string
}

const taskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  due_date: z.date().optional(),
})

type TaskFormValues = z.infer<typeof taskFormSchema>

export default function ProjectDetailsPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = React.useState<Project | null>(null)
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreatingTask, setIsCreatingTask] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      due_date: undefined,
    },
  })

  React.useEffect(() => {
    async function fetchProjectAndTasks() {
      if (!projectId) {
        console.error('No project ID provided')
        toast.error("Missing project ID")
        router.push('/projects')
        return
      }

      try {
        // Get current user first
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error('User error:', userError)
          throw userError
        }
        if (!user) {
          console.error('No user found')
          throw new Error("User not found")
        }

        console.log('Fetching project:', projectId)
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .eq('created_by', user.id)
          .single()

        if (projectError) {
          console.error('Project error:', projectError)
          throw projectError
        }
        if (!projectData) {
          console.error('No project found')
          throw new Error("Project not found")
        }

        console.log('Project found:', projectData)
        setProject(projectData)

        // Fetch tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })

        if (tasksError) {
          console.error('Tasks error:', tasksError)
          throw tasksError
        }

        console.log('Tasks found:', tasksData?.length || 0)
        setTasks(tasksData || [])
      } catch (error) {
        console.error('Error fetching data:', error)
        if (error instanceof Error) {
          toast.error(error.message)
        } else {
          toast.error("Failed to load project details")
        }
        router.push('/projects')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectAndTasks()
  }, [projectId, supabase, router])

  const handleCreateTask = async (values: TaskFormValues) => {
    if (!values.title.trim()) {
      toast.error("Task title is required")
      return
    }

    try {
      setIsCreatingTask(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not found")

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: values.title,
          description: values.description,
          due_date: values.due_date?.toISOString() || null,
          status: 'todo',
          project_id: projectId,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      setTasks(prev => [data, ...prev])
      form.reset()
      setIsDialogOpen(false)
      toast.success("Task created successfully")
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error("Failed to create task")
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleEditTask = async (values: TaskFormValues) => {
    if (!editingTask) return;

    try {
      setIsCreatingTask(true);
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not found")

      const updatedTask = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date?.toISOString() || null,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updatedTask)
        .eq('id', editingTask.id)
        .eq('created_by', user.id)
        .select()
        .single()

      if (error) throw error

      setTasks(prev => prev.map(task => 
        task.id === editingTask.id ? { ...task, ...updatedTask } : task
      ))
      
      form.reset()
      setIsDialogOpen(false)
      setEditingTask(null)
      toast.success("Task updated successfully")
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error("Failed to update task")
    } finally {
      setIsCreatingTask(false)
    }
  }

  // Update the dialog title and form when editing
  React.useEffect(() => {
    if (editingTask) {
      form.reset({
        title: editingTask.title,
        description: editingTask.description || "",
        due_date: editingTask.due_date ? new Date(editingTask.due_date) : undefined,
      })
    } else {
      form.reset({
        title: "",
        description: "",
        due_date: undefined,
      })
    }
  }, [editingTask, form])

  const toggleTaskStatus = async (taskId: string, currentStatus: Project['status']) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not found")

      // Cycle through statuses: todo -> in-progress -> done -> todo
      const newStatus: Project['status'] = (() => {
        switch (currentStatus) {
          case 'todo':
            return 'in-progress'
          case 'in-progress':
            return 'done'
          case 'done':
          default:
            return 'todo'
        }
      })()

      // Update task using the stored procedure
      const { error: updateError } = await supabase
        .rpc('update_task_status', {
          p_task_id: taskId,
          p_user_id: user.id,
          p_status: newStatus
        })

      if (updateError) throw updateError

      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ))

      const statusDisplay = newStatus === 'in-progress' ? 'in progress' : newStatus
      toast.success(`Task marked as ${statusDisplay}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error("Failed to update task status")
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not found")

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('created_by', user.id)

      if (error) throw error

      setTasks(prev => prev.filter(task => task.id !== taskId))
      toast.success("Task deleted successfully")
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error("Failed to delete task")
    }
  }

  // Add this sorting function before the return statement
  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      // If both tasks have due dates, compare them
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      }
      // If only a has a due date, it comes first
      if (a.due_date) return -1
      // If only b has a due date, it comes first
      if (b.due_date) return 1
      // If neither has a due date, sort by created date
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [tasks])

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    )
  }

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-700'
      case 'in-progress':
        return 'bg-blue-100 text-blue-700'
      case 'done':
        return 'bg-green-100 text-green-700'
    }
  }

  const getPriorityColor = (priority: Project['priority']) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'high':
        return 'bg-red-100 text-red-700'
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar className="hidden lg:block" />
      <SidebarInset className="bg-gradient-to-br from-white to-blue-50/20">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="flex w-full items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="rounded-lg hover:bg-blue-50 text-blue-600"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Button>
            </div>
          </div>
        </header>

        <main className="flex flex-col items-center justify-start py-8 px-4">
          <div className="w-full max-w-5xl space-y-6">
            {/* Project Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              {/* Project Title & Description */}
              <div className="col-span-1 md:col-span-2 xl:col-span-3 bg-white rounded-2xl border shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FolderKanban className="h-5 w-5 text-blue-600" />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/projects/new?edit=${project.id}`)}
                        className="rounded-lg hover:bg-blue-50 text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-2xl">{project.description}</p>
                  </div>
                  {project.attachments?.[0] && (
                    <img
                      src={project.attachments[0].url}
                      alt={project.attachments[0].name}
                      className="hidden md:block h-32 w-32 rounded-lg object-cover ring-2 ring-white shadow-md hover:scale-105 transition-transform cursor-pointer"
                    />
                  )}
                </div>
              </div>

              {/* Project Stats */}
              <div className="col-span-1 grid grid-cols-2 xl:grid-cols-1 gap-4">
                {/* Status Card */}
                <div className="bg-white rounded-2xl border shadow-sm p-4">
                  <div className="flex flex-col h-full">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Status</div>
                    <div className="flex items-center gap-2 mt-auto">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        project.status === 'todo' && "bg-gray-400",
                        project.status === 'in-progress' && "bg-blue-500",
                        project.status === 'done' && "bg-green-500"
                      )} />
                      <span className="text-sm font-medium capitalize">{project.status.replace('-', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Priority Card */}
                <div className="bg-white rounded-2xl border shadow-sm p-4">
                  <div className="flex flex-col h-full">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Priority</div>
                    <div className="flex items-center gap-2 mt-auto">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        project.priority === 'low' && "bg-green-500",
                        project.priority === 'medium' && "bg-yellow-500",
                        project.priority === 'high' && "bg-red-500"
                      )} />
                      <span className="text-sm font-medium capitalize">{project.priority}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Details */}
              <div className="col-span-1 md:col-span-2 xl:col-span-4 bg-white rounded-2xl border shadow-sm p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Due Date */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <CalendarDays className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Due Date</div>
                      <div className="text-sm font-medium">{format(new Date(project.due_date), 'MMM d, yyyy')}</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Tag className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="text-sm font-medium text-muted-foreground mb-1">Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {project.tags.map((tag, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-0.5 text-xs font-medium rounded-full"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Paperclip className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Attachments</div>
                      <div className="text-sm font-medium">
                        {project.attachments && project.attachments.length > 0 
                          ? `${project.attachments.length} ${project.attachments.length === 1 ? 'file' : 'files'}`
                          : 'No files'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks Section */}
            <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
                    <p className="text-sm text-muted-foreground">Manage and track your project tasks</p>
                  </div>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open)
                  if (!open) setEditingTask(null)
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => setIsDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                      <DialogDescription>
                        {editingTask 
                          ? 'Update your task details below.'
                          : 'Break down your project into manageable tasks to track progress effectively.'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(editingTask ? handleEditTask : handleCreateTask)} className="space-y-4 py-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Task Title</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter task title"
                                  className="h-12 text-base"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Enter task description"
                                  className="min-h-[120px] resize-none text-base"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="due_date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-sm font-medium">Due Date</FormLabel>
                              <div className="relative">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                          "w-full h-12 pl-3 text-left font-normal text-base transition-colors hover:border-blue-200 focus:border-blue-400",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value ? (
                                          format(field.value, "PPP")
                                        ) : (
                                          <span>Select a due date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-5 w-5 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      disabled={(date) =>
                                        date < new Date(new Date().setHours(0, 0, 0, 0))
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={isCreatingTask}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg h-12 text-base font-medium"
                          >
                            {isCreatingTask ? (
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                {editingTask ? 'Updating...' : 'Creating...'}
                              </div>
                            ) : (
                              editingTask ? 'Update Task' : 'Create Task'
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-100",
                      task.status === 'in-progress' && "bg-green-50",
                      task.status === 'done' && "bg-red-50"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    
                    {/* Action Buttons */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingTask(task)
                          setIsDialogOpen(true)
                        }}
                        className="h-8 w-8 bg-white/80 hover:bg-blue-50 border border-transparent hover:border-blue-100"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this task?')) {
                            deleteTask(task.id)
                          }
                        }}
                        className="h-8 w-8 bg-white/80 hover:bg-red-50 border border-transparent hover:border-red-100"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>

                    <div className="relative flex items-start gap-4">
                      <button
                        onClick={() => toggleTaskStatus(task.id, task.status)}
                        className="mt-1 flex-shrink-0 transition-transform hover:scale-110"
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="h-5 w-5 text-red-500" />
                        ) : task.status === 'in-progress' ? (
                          <Circle className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400 hover:text-blue-500" />
                        )}
                      </button>
                      <div className="flex-grow min-w-0">
                        <h3 className={cn(
                          "text-base font-medium text-gray-900 truncate",
                          task.status === 'done' && "line-through"
                        )}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className={cn(
                            "mt-1 text-sm text-gray-600 line-clamp-2",
                            task.status === 'done' && "line-through"
                          )}>
                            {task.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                          {task.due_date && (
                            <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
                              <CalendarDays className="h-3.5 w-3.5" />
                              Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(task.created_at), 'MMM d, yyyy')}
                          </div>
                          <Badge variant="secondary" className={cn(
                            "px-2 py-1 text-xs rounded-md shadow-sm backdrop-blur-sm",
                            task.status === 'done' && "bg-red-100 text-red-700 border-red-200/50",
                            task.status === 'in-progress' && "bg-green-100 text-green-700 border-green-200/50",
                            task.status === 'todo' && "bg-gray-100 text-gray-700 border-gray-200/50"
                          )}>
                            {task.status === 'in-progress' ? 'In Progress' : 
                             task.status === 'done' ? 'Completed' : 'To Do'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {tasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center bg-white/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100/50 text-blue-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-sm font-medium">No tasks yet</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      Create your first task to start tracking progress on this project
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
} 