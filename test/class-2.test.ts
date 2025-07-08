import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createParser } from "../src/parser";

const parser = createParser();

describe("Class 2 (Advanced Class Features)", () => {
	describe("Discriminated Unions", () => {
		// Define schemas for discriminated union types
		const ServerActionTaskSchema = z.object({
			type: z.literal("server_action"),
			name: z.string(),
			description: z.string(),
			signature: z.string(),
		});

		const PageTaskSchema = z.object({
			type: z.literal("page"),
			name: z.string(),
			description: z.string(),
			required_components: z.array(z.string()),
			required_actions: z.array(z.string()),
			route: z.string(),
		});

		const ComponentTaskSchema = z.object({
			type: z.literal("component"),
			name: z.string(),
			description: z.string(),
			props: z.string(),
		});

		// Union of task types
		const TaskUnionSchema = z.discriminatedUnion("type", [
			ServerActionTaskSchema,
			PageTaskSchema,
			ComponentTaskSchema,
		]);

		test("should parse single page task", () => {
			const input = `{
        type: page,
        name: HomePage,
        description: Landing page with post list,
        required_components: [PostCard, PostFilter],
        required_actions: [fetchPosts],
        route: /
      }`;

			const expected = {
				type: "page" as const,
				name: "HomePage",
				description: "Landing page with post list",
				required_components: ["PostCard", "PostFilter"],
				required_actions: ["fetchPosts"],
				route: "/",
			};

			const result = parser.parse(input, PageTaskSchema);
			expect(result).toEqual(expected);
		});

		test("should parse array with single server action", () => {
			const input = `[
        {
          type: server_action,
          name: fetchPosts,
          description: Fetch paginated blog posts with sorting and filtering,
          function_signature: async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>
        }
      ]`;

			const expected = [
				{
					type: "server_action" as const,
					name: "fetchPosts",
					description: "Fetch paginated blog posts with sorting and filtering",
					signature:
						"async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>",
				},
			];

			const result = parser.parse(input, z.array(TaskUnionSchema));
			expect(result).toEqual(expected);
		});

		test("should parse array with mixed task types", () => {
			const input = `[
        {
          type: server_action,
          name: fetchPosts,
          description: Fetch paginated blog posts with sorting and filtering,
          function_signature: async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>
        },
        {
          type: component,
          name: PostCard,
          description: Card component for displaying post preview on home page,
          props: {title: string, excerpt: string, author: Author, date: string, onClick: () => void}
        }
      ]`;

			const expected = [
				{
					type: "server_action" as const,
					name: "fetchPosts",
					description: "Fetch paginated blog posts with sorting and filtering",
					signature:
						"async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>",
				},
				{
					type: "component" as const,
					name: "PostCard",
					description:
						"Card component for displaying post preview on home page",
					props:
						"{title: string, excerpt: string, author: Author, date: string, onClick: () => void}",
				},
			];

			const result = parser.parse(input, z.array(TaskUnionSchema));
			expect(result).toEqual(expected);
		});

		test("should parse array with all three task types", () => {
			const input = `[
        {
          type: server_action,
          name: fetchPosts,
          description: Fetch paginated blog posts with sorting and filtering,
          function_signature: async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>
        },
        {
          type: component,
          name: PostCard,
          description: Card component for displaying post preview on home page,
          props: {title: string, excerpt: string, author: Author, date: string, onClick: () => void}
        },
        {
          type: page,
          name: HomePage,
          description: Landing page with post list,
          required_components: [PostCard, PostFilter],
          required_actions: [fetchPosts],
          route: /
        }
      ]`;

			const expected = [
				{
					type: "server_action" as const,
					name: "fetchPosts",
					description: "Fetch paginated blog posts with sorting and filtering",
					signature:
						"async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>",
				},
				{
					type: "component" as const,
					name: "PostCard",
					description:
						"Card component for displaying post preview on home page",
					props:
						"{title: string, excerpt: string, author: Author, date: string, onClick: () => void}",
				},
				{
					type: "page" as const,
					name: "HomePage",
					description: "Landing page with post list",
					required_components: ["PostCard", "PostFilter"],
					required_actions: ["fetchPosts"],
					route: "/",
				},
			];

			const result = parser.parse(input, z.array(TaskUnionSchema));
			expect(result).toEqual(expected);
		});

		test("should parse array with four task types", () => {
			const input = `[
        {
          type: server_action,
          name: fetchPosts,
          description: Fetch paginated blog posts with sorting and filtering,
          function_signature: async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>
        },
        {
          type: component,
          name: PostCard,
          description: Card component for displaying post preview on home page,
          props: {title: string, excerpt: string, author: Author, date: string, onClick: () => void}
        },
        {
          type: page,
          name: HomePage,
          description: Landing page with post list,
          required_components: [PostCard, PostFilter],
          required_actions: [fetchPosts],
          route: /
        },
        {
          type: server_action,
          name: fetchPostById,
          description: Fetch single post with full content and metadata,
          function_signature: async function fetchPostById(id: string): Promise<Post>
        }
      ]`;

			const expected = [
				{
					type: "server_action" as const,
					name: "fetchPosts",
					description: "Fetch paginated blog posts with sorting and filtering",
					signature:
						"async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>",
				},
				{
					type: "component" as const,
					name: "PostCard",
					description:
						"Card component for displaying post preview on home page",
					props:
						"{title: string, excerpt: string, author: Author, date: string, onClick: () => void}",
				},
				{
					type: "page" as const,
					name: "HomePage",
					description: "Landing page with post list",
					required_components: ["PostCard", "PostFilter"],
					required_actions: ["fetchPosts"],
					route: "/",
				},
				{
					type: "server_action" as const,
					name: "fetchPostById",
					description: "Fetch single post with full content and metadata",
					signature: "async function fetchPostById(id: string): Promise<Post>",
				},
			];

			const result = parser.parse(input, z.array(TaskUnionSchema));
			expect(result).toEqual(expected);
		});

		test("should parse complex markdown with embedded JSON", () => {
			const input = `
Let me break this down page by page:

Page 1: Home (/)
---
Features:
- List of blog post previews with title, excerpt, author
- Sort posts by date/popularity
- Filter by category/tag
Data:
- List of posts with preview data
- Sort/filter state
Actions:
- Fetch posts with sorting/filtering
- Navigate to individual posts
---

Page 2: Post Detail (/post/[id])
---
Features:
- Full post content display
- Author information section
- Comments section with add/reply
Data:
- Complete post data
- Author details
- Comments thread
Actions:
- Fetch post by ID
- Fetch comments
- Add/delete comments
---

Page 3: New Post (/new)
---
Features:
- Rich text editor interface
- Image upload capability
- Live preview
Data:
- Post draft data
- Uploaded images
Actions:
- Create new post
- Upload images
- Save draft
---

Page 4: Profile (/profile)
---
Features:
- User profile information
- Profile picture
- User's posts list
- Edit capabilities
Data:
- User profile data
- User's posts
Actions:
- Fetch user data
- Update profile
- Upload profile picture
---

[
  {
    type: server_action,
    name: fetchPosts,
    description: Fetch paginated blog posts with sorting and filtering,
    function_signature: async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>
  },
  {
    type: server_action,
    name: fetchPostById,
    description: Fetch single post with full content and metadata,
    function_signature: async function fetchPostById(id: string): Promise<Post>
  },
  {
    type: server_action,
    name: createPost,
    description: Create new blog post with content and images,
    function_signature: async function createPost(title: string, content: string, images: File[]): Promise<Post>
  },
  {
    type: server_action,
    name: fetchComments,
    description: Fetch comments for a post,
    function_signature: async function fetchComments(postId: string): Promise<Comment[]>
  },
  {
    type: server_action,
    name: addComment,
    description: Add new comment to a post,
    function_signature: async function addComment(postId: string, content: string): Promise<Comment>
  },
  {
    type: server_action,
    name: fetchUserProfile,
    description: Fetch user profile data and posts,
    function_signature: async function fetchUserProfile(userId: string): Promise<UserProfile>
  },
  {
    type: server_action,
    name: updateProfile,
    description: Update user profile information,
    function_signature: async function updateProfile(userId: string, data: ProfileData): Promise<UserProfile>
  },
  {
    type: component,
    name: PostCard,
    description: Card component for displaying post preview on home page,
    props: "{title: string, excerpt: string, author: Author, date: string, onClick: () => void}"
  },
   {
    type: component,
    name: PostFilter,
    description: Filter and sort controls for post list,
    props: "{onFilterChange: (filters: object) => void, onSortChange: (sort: string) => void}"
  },
   {
    type: component,
    name: RichTextEditor,
    description: Rich text editor component for creating posts,
    props: "{value: string, onChange: (content: string) => void, onImageUpload: (file: File) => Promise<string>}"
  },
  {
    type: component,
    name: CommentSection,
    description: Comments display and input component,
    props: {comments: Comment[], postId: string, onAddComment: (content: string) => void}
  },
  {
    type: component,
    name: ProfileHeader,
    description: User profile information display component,
    props: "{user: UserProfile, isEditable: boolean, onEdit: () => void}"
  },
  {
    type: page,
    name: HomePage,
    description: Landing page with post list,
    required_components: [PostCard, PostFilter],
    required_actions: [fetchPosts],
    route: /
  },
  {
    type: page,
    name: PostDetailPage,
    description: Full post display page,
    required_components: [CommentSection],
    required_actions: [fetchPostById, fetchComments, addComment],
    route: /post/[id]
  },
  {
    type: page,
    name: NewPostPage,
    description: Create new post page,
    required_components: [RichTextEditor],
    required_actions: [createPost],
    route: /new
  },
  {
    type: page,
    name: ProfilePage,
    description: User profile page,
    required_components: [ProfileHeader, PostCard],
    required_actions: [fetchUserProfile, updateProfile],
    route: /profile
  }
]`;

			const expected = [
				{
					type: "server_action" as const,
					name: "fetchPosts",
					description: "Fetch paginated blog posts with sorting and filtering",
					signature:
						"async function fetchPosts(page: number, sort: string, filters: object): Promise<PostList>",
				},
				{
					type: "server_action" as const,
					name: "fetchPostById",
					description: "Fetch single post with full content and metadata",
					signature: "async function fetchPostById(id: string): Promise<Post>",
				},
				{
					type: "server_action" as const,
					name: "createPost",
					description: "Create new blog post with content and images",
					signature:
						"async function createPost(title: string, content: string, images: File[]): Promise<Post>",
				},
				{
					type: "server_action" as const,
					name: "fetchComments",
					description: "Fetch comments for a post",
					signature:
						"async function fetchComments(postId: string): Promise<Comment[]>",
				},
				{
					type: "server_action" as const,
					name: "addComment",
					description: "Add new comment to a post",
					signature:
						"async function addComment(postId: string, content: string): Promise<Comment>",
				},
				{
					type: "server_action" as const,
					name: "fetchUserProfile",
					description: "Fetch user profile data and posts",
					signature:
						"async function fetchUserProfile(userId: string): Promise<UserProfile>",
				},
				{
					type: "server_action" as const,
					name: "updateProfile",
					description: "Update user profile information",
					signature:
						"async function updateProfile(userId: string, data: ProfileData): Promise<UserProfile>",
				},
				{
					type: "component" as const,
					name: "PostCard",
					description:
						"Card component for displaying post preview on home page",
					props:
						"{title: string, excerpt: string, author: Author, date: string, onClick: () => void}",
				},
				{
					type: "component" as const,
					name: "PostFilter",
					description: "Filter and sort controls for post list",
					props:
						"{onFilterChange: (filters: object) => void, onSortChange: (sort: string) => void}",
				},
				{
					type: "component" as const,
					name: "RichTextEditor",
					description: "Rich text editor component for creating posts",
					props:
						"{value: string, onChange: (content: string) => void, onImageUpload: (file: File) => Promise<string>}",
				},
				{
					type: "component" as const,
					name: "CommentSection",
					description: "Comments display and input component",
					props:
						"{comments: Comment[], postId: string, onAddComment: (content: string) => void}",
				},
				{
					type: "component" as const,
					name: "ProfileHeader",
					description: "User profile information display component",
					props: "{user: UserProfile, isEditable: boolean, onEdit: () => void}",
				},
				{
					type: "page" as const,
					name: "HomePage",
					description: "Landing page with post list",
					required_components: ["PostCard", "PostFilter"],
					required_actions: ["fetchPosts"],
					route: "/",
				},
				{
					type: "page" as const,
					name: "PostDetailPage",
					description: "Full post display page",
					required_components: ["CommentSection"],
					required_actions: ["fetchPostById", "fetchComments", "addComment"],
					route: "/post/[id]",
				},
				{
					type: "page" as const,
					name: "NewPostPage",
					description: "Create new post page",
					required_components: ["RichTextEditor"],
					required_actions: ["createPost"],
					route: "/new",
				},
				{
					type: "page" as const,
					name: "ProfilePage",
					description: "User profile page",
					required_components: ["ProfileHeader", "PostCard"],
					required_actions: ["fetchUserProfile", "updateProfile"],
					route: "/profile",
				},
			];

			const result = parser.parse(input, z.array(TaskUnionSchema));
			expect(result).toEqual(expected);
		});
	});

	describe("Streaming Classes", () => {
		// Schema for streaming tests
		const SmallThingSchema = z.object({
			i_16_digits: z.number(),
			i_8_digits: z.number(),
		});

		const ClassWithoutDoneSchema = z.object({
			i_16_digits: z.number(),
			s_20_words: z.string(),
		});

		const ClassWithBlockDoneSchema = z.object({
			i_16_digits: z.number(),
			s_20_words: z.string(),
		});

		const SemanticContainerSchema = z.object({
			sixteen_digit_number: z.number(),
			string_with_twenty_words: z.string(),
			class_1: ClassWithoutDoneSchema,
			class_2: ClassWithBlockDoneSchema,
			class_done_needed: ClassWithBlockDoneSchema,
			class_needed: ClassWithoutDoneSchema,
			three_small_things: z.array(SmallThingSchema),
			final_string: z.string(),
		});

		test("should parse streaming container with nested objects and arrays", () => {
			const input = `{
        "sixteen_digit_number": 1234567890123456,
        "string_with_twenty_words": "This is an example string that contains exactly twenty words for the requested output in JSON format. It is quite informative.",
        "class_1": {
          "i_16_digits": 9876543210123456,
          "s_20_words": "Another example string used for class one with twenty distinct words to complete the requirements of this JSON structure."
        },
        "class_2": {
          "i_16_digits": 4567890123456789,
          "s_20_words": "Class two also has a longer description that encompasses twenty unique words to fulfill the output specifications."
        },
        "class_done_needed": {
          "i_16_digits": 7890123456789012,
          "s_20_words": "This class indicates what has been completed and also includes twenty words in its description for clarity."
        },
        "class_needed": {
          "i_16_digits": 3210987654321098,
          "s_20_words": "Another class that explains what is currently needed for completion includes another twenty-word explanation for better understanding."
        },
        "three_small_things": [
          {
            "i_16_digits": 1357924680135792,
            "i_8_digits": 24681357
          },
          {
            "i_16_digits": 2468135790246813,
            "i_8_digits": 86421357
          },
          {
            "i_16_digits": 3571598642035791,
            "i_8_digits": 97586421
          }
        ],
        "final_string": "This final string provides a brief conclusion or summary of the entire JSON formatted data provided above."
      }`;

			const expected = {
				sixteen_digit_number: 1234567890123456,
				string_with_twenty_words:
					"This is an example string that contains exactly twenty words for the requested output in JSON format. It is quite informative.",
				class_1: {
					i_16_digits: 9876543210123456,
					s_20_words:
						"Another example string used for class one with twenty distinct words to complete the requirements of this JSON structure.",
				},
				class_2: {
					i_16_digits: 4567890123456789,
					s_20_words:
						"Class two also has a longer description that encompasses twenty unique words to fulfill the output specifications.",
				},
				class_done_needed: {
					i_16_digits: 7890123456789012,
					s_20_words:
						"This class indicates what has been completed and also includes twenty words in its description for clarity.",
				},
				class_needed: {
					i_16_digits: 3210987654321098,
					s_20_words:
						"Another class that explains what is currently needed for completion includes another twenty-word explanation for better understanding.",
				},
				three_small_things: [
					{
						i_16_digits: 1357924680135792,
						i_8_digits: 24681357,
					},
					{
						i_16_digits: 2468135790246813,
						i_8_digits: 86421357,
					},
					{
						i_16_digits: 3571598642035791,
						i_8_digits: 97586421,
					},
				],
				final_string:
					"This final string provides a brief conclusion or summary of the entire JSON formatted data provided above.",
			};

			const result = parser.parse(input, SemanticContainerSchema);
			expect(result).toEqual(expected);
		});

		test("should parse SmallThing object", () => {
			const input = `{
        "i_16_digits": 123456789012345,
        "i_8_digits": 12345
      }`;

			const expected = {
				i_16_digits: 123456789012345,
				i_8_digits: 12345,
			};

			const result = parser.parse(input, SmallThingSchema);
			expect(result).toEqual(expected);
		});
	});

	describe("Partial Parsing", () => {
		const SemanticContainer2Schema = z.object({
			three_small_things: z.array(
				z.object({
					i_16_digits: z.number(),
					i_8_digits: z.number(),
				}),
			),
		});

		const PartialSemanticContainerSchema = z.object({
			sixteen_digit_number: z.number(),
			string_with_twenty_words: z.string(),
			class_1: z.object({
				i_16_digits: z.number(),
				s_20_words: z.string(),
			}),
			class_2: z.object({
				i_16_digits: z.number(),
				s_20_words: z.string(),
			}),
			class_done_needed: z.object({
				i_16_digits: z.number(),
				s_20_words: z.string(),
			}),
			class_needed: z.object({
				i_16_digits: z.number(),
				s_20_words: z.string(),
			}),
			three_small_things: z.array(
				z.object({
					i_16_digits: z.number(),
					i_8_digits: z.number().nullable(),
				}),
			),
			final_string: z.string().nullable(),
		});

		test("should handle partial streaming container with incomplete array", () => {
			const input = `{
        "three_small_things": [
          {
            "i_16_digits": 123456789012345`;

			const expected = {
				three_small_things: [],
			};

			const result = parser.parse(input, SemanticContainer2Schema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		test("should handle partial semantic container with nested data", () => {
			const input = `{
      "sixteen_digit_number": 1234567890123456,
      "string_with_twenty_words": "This is an example string that contains exactly twenty words for the requested output in JSON format. It is quite informative.",
      "class_1": {
        "i_16_digits": 9876543210123456,
        "s_20_words": "Another example string used for class one with twenty distinct words to complete the requirements of this JSON structure."
      },
      "class_2": {
        "i_16_digits": 4567890123456789,
        "s_20_words": "Class two also has a longer description that encompasses twenty unique words to fulfill the output specifications."
      },
      "class_done_needed": {
        "i_16_digits": 7890123456789012,
        "s_20_words": "This class indicates what has been completed and also includes twenty words in its description for clarity."
      },
      "class_needed": {
        "i_16_digits": 3210987654321098,
        "s_20_words": "Another class that explains what is currently needed for completion includes another twenty-word explanation for better understanding."
      },
      "three_small_things": [{
        "i_16_digits": 123`;

			const expected = {
				sixteen_digit_number: 1234567890123456,
				string_with_twenty_words:
					"This is an example string that contains exactly twenty words for the requested output in JSON format. It is quite informative.",
				class_1: {
					i_16_digits: 9876543210123456,
					s_20_words:
						"Another example string used for class one with twenty distinct words to complete the requirements of this JSON structure.",
				},
				class_2: {
					i_16_digits: 4567890123456789,
					s_20_words:
						"Class two also has a longer description that encompasses twenty unique words to fulfill the output specifications.",
				},
				class_done_needed: {
					i_16_digits: 7890123456789012,
					s_20_words:
						"This class indicates what has been completed and also includes twenty words in its description for clarity.",
				},
				class_needed: {
					i_16_digits: 3210987654321098,
					s_20_words:
						"Another class that explains what is currently needed for completion includes another twenty-word explanation for better understanding.",
				},
				three_small_things: [],
				final_string: null,
			};

			const result = parser.parse(input, PartialSemanticContainerSchema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});

		test("should handle partial streaming container with one valid item", () => {
			const PartialSemanticContainer2Schema = z.object({
				three_small_things: z.array(
					z.object({
						i_16_digits: z.number(),
						i_8_digits: z.number().nullable(),
					}),
				),
			});

			const input = `{
      "three_small_things": [
        {
          "i_16_digits": 123456789012345,`;

			const expected = {
				three_small_things: [
					{
						i_16_digits: 123456789012345,
						i_8_digits: null,
					},
				],
			};

			const result = parser.parse(input, PartialSemanticContainer2Schema, {
				allowPartial: true,
			});
			expect(result).toEqual(expected);
		});
	});
});
