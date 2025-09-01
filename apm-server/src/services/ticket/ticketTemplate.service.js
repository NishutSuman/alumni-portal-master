const { prisma } = require("../../config/database");
const CacheService = require("../../config/redis");
const TicketAuditService = require("./ticketAudit.service");

class TicketTemplateService {
	// ==========================================
	// TEMPLATE MANAGEMENT
	// ==========================================

	static async getActiveTemplates(categoryId = null, userId = null) {
		const cacheKey = categoryId
			? `templates:category:${categoryId}:active`
			: "templates:all:active";

		const cached = await CacheService.get(cacheKey);
		if (cached) return cached;

		const where = {
			isActive: true,
			OR: [{ isPublic: true }, ...(userId ? [{ createdBy: userId }] : [])],
			...(categoryId && { categoryId }),
		};

		const templates = await prisma.ticketTemplate.findMany({
			where,
			include: {
				category: {
					select: { id: true, name: true, icon: true },
				},
				creator: {
					select: { id: true, fullName: true },
				},
			},
			orderBy: [{ sortOrder: "asc" }, { usageCount: "desc" }, { name: "asc" }],
		});

		await CacheService.set(cacheKey, templates, 1800); // 30 minutes
		return templates;
	}

	static async getTemplateById(templateId) {
		const cacheKey = `templates:details:${templateId}`;
		const cached = await CacheService.get(cacheKey);

		if (cached) return cached;

		const template = await prisma.ticketTemplate.findUnique({
			where: { id: templateId },
			include: {
				category: {
					select: { id: true, name: true, icon: true },
				},
				creator: {
					select: { id: true, fullName: true },
				},
			},
		});

		if (!template) {
			throw new Error("Template not found");
		}

		await CacheService.set(cacheKey, template, 3600); // 1 hour
		return template;
	}

	static async createTemplate(adminId, templateData) {
		const {
			name,
			description,
			categoryId,
			subjectTemplate,
			descriptionTemplate,
			priorityDefault,
			hasCustomFields,
			customFields,
			isPublic,
			sortOrder,
		} = templateData;

		const template = await prisma.ticketTemplate.create({
			data: {
				name: name.trim(),
				description: description?.trim(),
				categoryId,
				subjectTemplate: subjectTemplate.trim(),
				descriptionTemplate: descriptionTemplate.trim(),
				priorityDefault,
				hasCustomFields: hasCustomFields || false,
				customFields,
				isPublic: isPublic !== false, // Default to true
				sortOrder: sortOrder || 0,
				createdBy: adminId,
			},
			include: {
				category: {
					select: { id: true, name: true },
				},
				creator: {
					select: { id: true, fullName: true },
				},
			},
		});

		// Invalidate template caches
		await this.invalidateTemplateCaches();

		return template;
	}

	static async updateTemplate(templateId, adminId, updateData) {
		const template = await prisma.ticketTemplate.findUnique({
			where: { id: templateId },
			select: { createdBy: true },
		});

		if (!template) {
			throw new Error("Template not found");
		}

		// Only creator or super admin can update
		const user = await prisma.user.findUnique({
			where: { id: adminId },
			select: { role: true },
		});

		if (template.createdBy !== adminId && user.role !== "SUPER_ADMIN") {
			throw new Error("Permission denied to update this template");
		}

		const updatedTemplate = await prisma.ticketTemplate.update({
			where: { id: templateId },
			data: {
				...updateData,
				updatedAt: new Date(),
			},
			include: {
				category: {
					select: { id: true, name: true },
				},
				creator: {
					select: { id: true, fullName: true },
				},
			},
		});

		await this.invalidateTemplateCaches();
		return updatedTemplate;
	}

	static async useTemplate(templateId, userId) {
		const template = await this.getTemplateById(templateId);

		if (!template.isActive) {
			throw new Error("Template is not active");
		}

		if (!template.isPublic) {
			// Check if user has access to private template
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { role: true },
			});

			if (template.createdBy !== userId && user.role !== "SUPER_ADMIN") {
				throw new Error("Access denied to this template");
			}
		}

		// Update usage statistics
		await prisma.ticketTemplate.update({
			where: { id: templateId },
			data: {
				usageCount: { increment: 1 },
				lastUsedAt: new Date(),
			},
		});

		// Process template placeholders if any
		const processedTemplate = this.processTemplateContent(template, userId);

		return processedTemplate;
	}

	// ==========================================
	// TEMPLATE PROCESSING
	// ==========================================

	static processTemplateContent(template, userId) {
		// Process placeholders in template content
		// This can be enhanced to support dynamic placeholders

		let { subjectTemplate, descriptionTemplate } = template;

		// Basic placeholder replacement (can be enhanced)
		const replacements = {
			"{user_name}": "", // Will be filled by frontend
			"{current_date}": new Date().toLocaleDateString(),
			"{ticket_category}": template.category.name,
		};

		Object.entries(replacements).forEach(([placeholder, value]) => {
			subjectTemplate = subjectTemplate.replace(
				new RegExp(placeholder, "g"),
				value
			);
			descriptionTemplate = descriptionTemplate.replace(
				new RegExp(placeholder, "g"),
				value
			);
		});

		return {
			...template,
			subjectTemplate,
			descriptionTemplate,
		};
	}

	static async invalidateTemplateCaches() {
		const patterns = [
			"templates:*",
			"tickets:categories:*", // Templates affect category data
		];

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);
	}
}

module.exports = TicketTemplateService;
