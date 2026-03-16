"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createCourse } from "@/actions/course"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { SubmitHandler } from "react-hook-form"
import Link from 'next/link'

const formSchema = z.object({
  title: z.string().min(1, { message: "Tiêu đề là bắt buộc" }),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function CreateCoursePage() {
    const router = useRouter()
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
        }
    })

    const { isSubmitting } = form.formState

    const onSubmit: SubmitHandler<FormValues> = async (values) => {
        try {
            const res = await createCourse({
                title: values.title,
                description: values.description, 
                // thumbnail is optional and handled later or we add a field now if simple link
            })
            if (res.success && res.courseId) {
                toast.success("Khóa học đã được tạo")
                router.push(`/teacher/courses/${res.courseId}`)
            } else {
                toast.error("Có lỗi xảy ra")
            }
        } catch {
            toast.error("Có lỗi xảy ra")
        }
    }

    return (
        <div className="max-w-5xl mx-auto flex md:items-center md:justify-center h-full p-6">
            <div className="w-full">
                <h1 className="text-2xl font-bold">Đặt tên khóa học</h1>
                <p className="text-sm text-slate-600">
                    Bạn muốn đặt tên khóa học là gì? Đừng lo, bạn có thể thay đổi nó sau.
                </p>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-8">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tiêu đề khóa học</FormLabel>
                                    <FormControl>
                                        <Input disabled={isSubmitting} placeholder="VD: Lập trình Web Fullstack" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Bạn sẽ dạy gì trong khóa học này?
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                         <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mô tả ngắn</FormLabel>
                                    <FormControl>
                                        <Textarea disabled={isSubmitting} placeholder="Mô tả về những gì học viên sẽ học được..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex items-center gap-x-2">
                            <Link href="/teacher/courses">
                                <Button type="button" variant="ghost">Hủy</Button>
                            </Link>
                            <Button type="submit" disabled={isSubmitting}>
                                Tiếp tục
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    )
}
