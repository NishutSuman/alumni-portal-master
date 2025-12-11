import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  XMarkIcon,
  PhotoIcon,
  DocumentIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { POST_CATEGORIES, PostFormData, Post } from '../../types/post';
import { useCreatePostMutation, useUpdatePostMutation } from '../../store/api/postApi';
import { Button } from '../common/UI/Button';
import LoadingSpinner from '../common/UI/LoadingSpinner';
import RichTextEditor from '../common/UI/RichTextEditor';
import SimpleMentionEditor from '../common/UI/SimpleMentionEditor';
import HybridRichTextEditor from '../common/UI/HybridRichTextEditor';
import toast from 'react-hot-toast';

// Validation schema (matches backend expectations)
const postSchema = yup.object({
  title: yup.string()
    .required('Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be less than 200 characters'),
  body: yup.string()
    .required('Content is required')
    .min(10, 'Content must be at least 10 characters')
    .max(50000, 'Content must be less than 50,000 characters'),
  category: yup.string().required('Category is required'),
  linkedEventId: yup.string().optional(),
  tags: yup.array().of(yup.string()),
  allowComments: yup.boolean().default(true),
  allowLikes: yup.boolean().default(true),
});

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  editPost?: Post | null; // Post to edit, null for create mode
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  editPost,
}) => {

  const [createPost, { isLoading: creatingPost }] = useCreatePostMutation();
  const [updatePost, { isLoading: updatingPost }] = useUpdatePostMutation();
  
  const isEditing = !!editPost;
  const isLoading = creatingPost || updatingPost;
  
  // Helper function to convert R2 URLs to proxy URLs
  const getProxyImageUrl = (r2Url: string, postId: string, index?: number): string => {
    if (!r2Url) return r2Url;
    
    // Check if it's already a proxy URL
    if (r2Url.startsWith('/api/') || r2Url.startsWith('http://localhost:')) {
      return r2Url;
    }
    
    // Convert R2 URL to proxy URL
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    if (index !== undefined) {
      // Additional image
      return `${baseUrl}/api/posts/${postId}/images/${index}`;
    } else {
      // Hero image
      return `${baseUrl}/api/posts/${postId}/hero-image`;
    }
  };
  
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PostFormData>({
    resolver: yupResolver(postSchema),
    mode: 'onSubmit', // Only validate on submit, not on change
    defaultValues: {
      title: '',
      body: '',
      category: 'POST',
      linkedEventId: '',
      tags: [],
      allowComments: true,
      allowLikes: true,
    },
  });

  const watchedTags = watch('tags');

  // Populate form when editing
  useLayoutEffect(() => {
    if (isOpen && editPost) {
      // Populate form fields
      setValue('title', editPost.title);
      setValue('body', editPost.body);
      setValue('category', editPost.category);
      setValue('tags', editPost.tags || []);
      setValue('allowComments', editPost.allowComments);
      setValue('allowLikes', editPost.allowLikes);
      
      // Set images using proxy URLs
      if (editPost.heroImage) {
        const proxyHeroUrl = getProxyImageUrl(editPost.heroImage, editPost.id);
        setHeroImagePreview(proxyHeroUrl);
      }
      
      if (editPost.images && editPost.images.length > 0) {
        const proxyImageUrls = editPost.images.map((url, index) => getProxyImageUrl(url, editPost.id, index));
        setImagePreviewUrls(proxyImageUrls);
      }
      
      // Clear any new uploads
      setAdditionalImages([]);
    } else if (isOpen && !editPost) {
      // Reset for create mode
      setHeroImagePreview(null);
      setImagePreviewUrls([]);
      setAdditionalImages([]);
    }
  }, [isOpen, editPost, setValue]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setHeroImagePreview(null);
      setAdditionalImages([]);
      setImagePreviewUrls([]);
      setTagInput('');
      setHasSubmitted(false);
      setMentions([]);
    }
  }, [isOpen, reset]);


  // Handle hero image selection
  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Hero image must be less than 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setHeroImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      setValue('heroImage', file);
    }
  };

  // Handle additional images selection
  const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (additionalImages.length + files.length + imagePreviewUrls.length > 9) {
      toast.error('Maximum 9 additional images allowed');
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      const newImages = [...additionalImages, ...validFiles];
      setAdditionalImages(newImages);
    }
    
    // Clear the input to allow selecting the same file again
    e.target.value = '';
  };

  // Remove existing image (from imagePreviewUrls - existing images from server)
  const removeExistingImage = (index: number) => {
    console.log('🗑️ Removing existing image at index:', index);
    const newPreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);
    setImagePreviewUrls(newPreviewUrls);
    console.log('🖼️ Updated existing images:', newPreviewUrls);
  };

  // Remove additional image (from additionalImages - newly uploaded files)
  const removeAdditionalImage = (index: number) => {
    console.log('🗑️ Removing additional image at index:', index);
    const newImages = additionalImages.filter((_, i) => i !== index);
    setAdditionalImages(newImages);
    console.log('📁 Updated additional images:', newImages);
  };

  // Handle tag input
  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !watchedTags.includes(trimmedTag) && watchedTags.length < 10) {
      setValue('tags', [...watchedTags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', watchedTags.filter(tag => tag !== tagToRemove));
  };

  // Handle form submission
  const onSubmit = async (data: PostFormData) => {
    setHasSubmitted(true);
    try {
      const formData = new FormData();
      
      // Add text fields (matching backend expectations)
      formData.append('title', data.title);
      formData.append('body', data.body); // Backend expects 'body', not 'content'
      formData.append('category', data.category);
      formData.append('allowComments', data.allowComments.toString());
      formData.append('allowLikes', data.allowLikes.toString());
      
      // Add linked event ID if provided
      if (data.linkedEventId) {
        formData.append('linkedEventId', data.linkedEventId);
      }
      
      // Add tags as JSON string (array of user IDs) - now these are mentions
      const allMentions = [...new Set([...data.tags, ...mentions])]; // Combine and deduplicate
      if (allMentions.length > 0) {
        formData.append('tags', JSON.stringify(allMentions));
      }
      
      // Add hero image
      if (data.heroImage) {
        formData.append('heroImage', data.heroImage);
      }
      
      // Add additional images (new files)
      if (additionalImages && additionalImages.length > 0) {
        console.log('📁 Adding additional images to FormData:', additionalImages.length);
        additionalImages.forEach((image, index) => {
          console.log(`📷 Adding image ${index}:`, image.name, image.size);
          formData.append('images', image);
        });
      } else {
        console.log('⚠️ No additional images to add');
      }
      
      // For editing: Add existing images that should be kept
      if (isEditing) {
        formData.append('existingImages', JSON.stringify(imagePreviewUrls));
      }

      if (isEditing && editPost) {
        await updatePost({ postId: editPost.id, formData }).unwrap();
        toast.success('Post updated successfully!');
      } else {
        await createPost(formData).unwrap();
        toast.success('Post created successfully!');
      }
      
      handleClose();
    } catch (error: any) {
      console.error('Failed to save post:', error);
      const errorMessage = error?.data?.message || (isEditing ? 'Failed to update post' : 'Failed to create post');
      toast.error(errorMessage);
    }
  };

  // Handle modal close
  const handleClose = () => {
    reset({
      title: '',
      body: '',
      category: 'POST',
      linkedEventId: '',
      tags: [],
      allowComments: true,
      allowLikes: true,
    });
    setHeroImagePreview(null);
    setAdditionalImages([]);
    setImagePreviewUrls([]);
    setTagInput('');
    setHasSubmitted(false);
    setMentions([]);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                    {isEditing ? 'Edit Post' : 'Create New Post'}
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Title *
                        </label>
                        <input
                          {...register('title')}
                          type="text"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter post title"
                        />
                        {hasSubmitted && errors.title && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.title.message}</p>
                        )}
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Category *
                        </label>
                        <select
                          {...register('category')}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {POST_CATEGORIES.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                        {hasSubmitted && errors.category && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.category.message}</p>
                        )}
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {watchedTags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-md text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300"
                            >
                              #{tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagInputKeyDown}
                            placeholder="Add tags (press Enter)"
                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={addTag}
                            className="px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-r-md hover:bg-blue-700 dark:hover:bg-blue-600"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Settings */}
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <input
                            {...register('allowComments')}
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                          />
                          <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Allow comments
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            {...register('allowLikes')}
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                          />
                          <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Allow likes
                          </label>
                        </div>
                      </div>

                      {/* Scheduled Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Linked Event (optional)
                        </label>
                        <input
                          {...register('linkedEventId')}
                          type="text"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter event ID (optional)"
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Hero Image */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Hero Image
                        </label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                          {heroImagePreview ? (
                            <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                              <img
                                src={heroImagePreview}
                                alt="Hero preview"
                                className="w-full h-48 object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setHeroImagePreview(null);
                                  setValue('heroImage', undefined);
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer block text-center">
                              <PhotoIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Click to upload hero image
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleHeroImageChange}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Additional Images */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Additional Images ({imagePreviewUrls.length + additionalImages.length}/9)
                        </label>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {/* Existing images from server */}
                          {imagePreviewUrls.map((url, index) => (
                            <div key={`existing-${index}`} className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                              <img
                                src={url}
                                alt={`Existing image ${index}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => removeExistingImage(index)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                                title="Remove existing image"
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          
                          {/* Newly uploaded images */}
                          {additionalImages.map((file, index) => {
                            const url = URL.createObjectURL(file);
                            return (
                              <div key={`new-${index}`} className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                                <img
                                  src={url}
                                  alt={`New image ${index}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeAdditionalImage(index)}
                                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                                  title="Remove new image"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {(imagePreviewUrls.length + additionalImages.length) < 9 && (
                          <label className="cursor-pointer block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center bg-gray-50 dark:bg-gray-700">
                            <PlusIcon className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 mb-1" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Add more images</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleAdditionalImagesChange}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Content *
                    </label>
                    <Controller
                      name="body"
                      control={control}
                      render={({ field }) => (
                        <HybridRichTextEditor
                          content={field.value}
                          onChange={(content, mentionIds) => {
                            field.onChange(content);
                            setMentions(mentionIds);
                          }}
                          placeholder="Write your post content here..."
                          disabled={isLoading}
                        />
                      )}
                    />
                    {hasSubmitted && errors.body && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.body.message}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex items-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>{isEditing ? 'Updating...' : 'Creating...'}</span>
                        </>
                      ) : (
                        <span>{isEditing ? 'Update Post' : 'Create Post'}</span>
                      )}
                    </Button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreatePostModal;