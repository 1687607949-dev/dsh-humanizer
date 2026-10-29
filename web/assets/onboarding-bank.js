export const OB_QUESTIONS = [
  {
    id: 'Q1',
    title: '你最常希望姆咪陪你做什么？',
    hint: '多选，最多 4 项；只影响任务场景，不推断职业',
    type: 'multi',
    max: 4,
    groups: [
      {
        label: '技术与工程',
        options: [
          { id: 'coding', label: '代码编写' },
          { id: 'code_review', label: '代码审查' },
          { id: 'architecture', label: '软件架构' },
          { id: 'troubleshooting', label: '系统排障' },
          { id: 'configuration', label: '配置管理' },
          { id: 'testing', label: '测试与验证' }
        ]
      },
      {
        label: '研究与学习',
        options: [
          { id: 'research', label: '搜索研究' },
          { id: 'comparison', label: '技术比较' },
          { id: 'learning', label: '概念解释' },
          { id: 'study_planning', label: '学习计划' },
          { id: 'literature_review', label: '文献整理' },
          { id: 'decision_support', label: '决策分析' }
        ]
      },
      {
        label: '创作与规划',
        options: [
          { id: 'storytelling', label: '故事创作' },
          { id: 'character_design', label: '角色设定' },
          { id: 'visual_prompting', label: '视觉提示词' },
          { id: 'brainstorming', label: '头脑风暴' },
          { id: 'project_planning', label: '项目规划' },
          { id: 'writing', label: '写作润色' }
        ]
      },
      {
        label: '日常与陪伴',
        options: [
          { id: 'casual_chat', label: '日常聊天' },
          { id: 'daily_sharing', label: '分享趣事' },
          { id: 'emotional_chat', label: '情绪交流' },
          { id: 'life_decisions', label: '生活决策' },
          { id: 'habit_support', label: '习惯养成' },
          { id: 'fictional_roleplay', label: '虚构情境互动' }
        ]
      }
    ]
  },
  {
    id: 'Q2',
    title: '哪几种性格特质最吸引你？',
    hint: '多选，最多 5 项；选中项默认普通偏好',
    type: 'multi',
    max: 5,
    groups: [
      {
        label: '理性与洞察',
        options: [
          { id: 'intellectual', label: '冷静智者' },
          { id: 'observant', label: '敏锐观察者' },
          { id: 'logical', label: '逻辑分析者' },
          { id: 'strategist', label: '战略策划者' },
          { id: 'curious', label: '好奇探索者' },
          { id: 'scholarly', label: '博学研究者' }
        ]
      },
      {
        label: '温暖与连接',
        options: [
          { id: 'warm', label: '温暖亲和' },
          { id: 'empathetic', label: '善解人意' },
          { id: 'loyal', label: '忠诚可靠' },
          { id: 'considerate', label: '细心体贴' },
          { id: 'encouraging', label: '乐观鼓舞' },
          { id: 'protective', label: '沉稳守护' }
        ]
      },
      {
        label: '强势与独立',
        options: [
          { id: 'proud_queen', label: '高傲大小姐' },
          { id: 'decisive_leader', label: '果断主导' },
          { id: 'sharp_tongued', label: '毒舌机敏' },
          { id: 'tsundere', label: '傲娇反差' },
          { id: 'independent', label: '独立自信' },
          { id: 'competitive', label: '竞争心强' }
        ]
      },
      {
        label: '灵动与非凡',
        options: [
          { id: 'mischievous_catlike', label: '猫系恶作剧' },
          { id: 'quirky', label: '古灵精怪' },
          { id: 'mysterious', label: '神秘莫测' },
          { id: 'elegant', label: '优雅从容' },
          { id: 'adventurous', label: '冒险无畏' },
          { id: 'inhuman_charm', label: '非人类异质感' }
        ]
      }
    ]
  },
  {
    id: 'Q3',
    title: '你希望和她怎样相处？',
    hint: '多选，最多 3 项；这是互动体验，不是心理类型',
    type: 'multi',
    max: 3,
    groups: [
      {
        label: '轻松日常',
        options: [
          { id: 'casual', label: '自然随意' },
          { id: 'comedic', label: '轻松搞笑' },
          { id: 'banter', label: '互相吐槽' },
          { id: 'quiet_companionship', label: '一起发呆' },
          { id: 'daily_intimacy', label: '分享生活' },
          { id: 'comfortable', label: '舒适熟悉' }
        ]
      },
      {
        label: '并肩协作',
        options: [
          { id: 'equal_partner', label: '平等搭档' },
          { id: 'in_sync', label: '默契队友' },
          { id: 'intellectual_duel', label: '智力较量' },
          { id: 'problem_solving', label: '共同攻关' },
          { id: 'mutual_motivation', label: '相互激励' },
          { id: 'complementary', label: '互相补位' }
        ]
      },
      {
        label: '情绪与关怀',
        options: [
          { id: 'accepting', label: '温暖接纳' },
          { id: 'quiet_support', label: '安静陪伴' },
          { id: 'candid', label: '直接坦率' },
          { id: 'emotionally_attuned', label: '细腻共情' },
          { id: 'steady_support', label: '可靠守护' },
          { id: 'rare_softness', label: '偶尔流露柔软' }
        ]
      },
      {
        label: '张力与角色感',
        options: [
          { id: 'aristocratic_tension', label: '大小姐气场' },
          { id: 'playful_teasing', label: '猫系逗弄' },
          { id: 'powerful_duo', label: '强强对峙' },
          { id: 'mysterious_bond', label: '神秘吸引' },
          { id: 'special_affection', label: '专属偏爱' },
          { id: 'immersive_roleplay', label: '虚构角色扮演' }
        ]
      }
    ]
  },
  {
    id: 'Q4',
    title: '你喜欢她怎样说话？',
    hint: '多选，最多 4 项；调整表达倾向，不是逐句脚本',
    type: 'multi',
    max: 4,
    groups: [
      {
        label: '句式与节奏',
        options: [
          { id: 'terse', label: '极简短句' },
          { id: 'concise_explanatory', label: '简洁但有解释' },
          { id: 'structured', label: '层次分明' },
          { id: 'rhetorical', label: '善用反问' },
          { id: 'directive', label: '命令式表达' },
          { id: 'narrative', label: '叙述感较强' }
        ]
      },
      {
        label: '幽默与锋芒',
        options: [
          { id: 'humorous', label: '轻松幽默' },
          { id: 'witty', label: '机智反击' },
          { id: 'gentle_teasing', label: '温和调侃' },
          { id: 'sharp_wit', label: '犀利毒舌' },
          { id: 'deadpan', label: '冷面幽默' },
          { id: 'dramatic', label: '夸张戏剧感' }
        ]
      },
      {
        label: '情感表达',
        options: [
          { id: 'restrained', label: '克制内敛' },
          { id: 'direct_emotional', label: '坦率直白' },
          { id: 'occasional_tenderness', label: '偶尔软化' },
          { id: 'encouraging_tone', label: '积极鼓励' },
          { id: 'affectionate_tone', label: '亲昵自然' },
          { id: 'detached', label: '冷静疏离' }
        ]
      },
      {
        label: '语言质感',
        options: [
          { id: 'refined', label: '优雅讲究' },
          { id: 'colloquial', label: '日常口语' },
          { id: 'sci_fi', label: '科幻感' },
          { id: 'literary', label: '文学化' },
          { id: 'catlike_playful', label: '猫系俏皮' },
          { id: 'signature_quirks', label: '偶尔使用专属口癖' }
        ]
      }
    ]
  },
  {
    id: 'Q5',
    title: '不同情境下，你希望她多主动？',
    hint: '每组选 1 项；没选的情境保持未知',
    type: 'context',
    groups: [
      {
        key: 'chat',
        label: '闲聊',
        options: [
          { id: 'chat_proactive', label: '经常开话题' },
          { id: 'topic_triggered', label: '发现有趣内容再分享' },
          { id: 'topic_followup', label: '主动接续已有话题' },
          { id: 'chat_responsive', label: '以回应为主' },
          { id: 'selective_initiative', label: '只在有价值时主动' },
          { id: 'chat_quiet', label: '保持安静等待' }
        ]
      },
      {
        key: 'work',
        label: '工作',
        options: [
          { id: 'task_breakdown', label: '主动拆解任务' },
          { id: 'risk_proactive', label: '主动指出风险' },
          { id: 'optimization_proactive', label: '主动提出优化' },
          { id: 'instruction_focused', label: '仅完成明确指令' },
          { id: 'clarification_first', label: '遇到歧义先提问' },
          { id: 'post_task_suggestion', label: '完成后再建议下一步' }
        ]
      },
      {
        key: 'emotional',
        label: '情绪',
        options: [
          { id: 'check_in', label: '主动询问状态' },
          { id: 'signal_based_checkin', label: '察觉明显变化再问' },
          { id: 'support_then_ask', label: '先陪伴再询问' },
          { id: 'solution_first', label: '直接给解决方案' },
          { id: 'wait_for_disclosure', label: '等用户主动表达' },
          { id: 'low_intrusion_support', label: '保持轻松，不深入探问' }
        ]
      },
      {
        key: 'reminders',
        label: '提醒',
        options: [
          { id: 'proactive_reminders', label: '主动提醒' },
          { id: 'agreed_reminders', label: '仅提醒已约定事项' },
          { id: 'gentle_reminders', label: '在合适时机轻提醒' },
          { id: 'planning_support', label: '帮助制定计划' },
          { id: 'on_request_followup', label: '只在询问时跟进' },
          { id: 'no_reminders', label: '不承担提醒任务' }
        ]
      }
    ]
  },
  {
    id: 'Q6',
    title: '哪些视觉风格最吸引你？',
    hint: '多选，最多 4 项；不改变姆咪固定外观',
    type: 'multi',
    max: 4,
    groups: [
      {
        label: '美术方向',
        options: [
          { id: 'anime_refined', label: '精致二次元' },
          { id: 'chibi', label: 'Q 版萌系' },
          { id: 'realistic_render', label: '写实渲染' },
          { id: 'cinematic_animation', label: '动画电影感' },
          { id: 'pixel_art', label: '像素艺术' },
          { id: 'flat_illustration', label: '平面插画' }
        ]
      },
      {
        label: '氛围与配色',
        options: [
          { id: 'blue_cool', label: '蓝白冷感' },
          { id: 'black_red', label: '黑红对比' },
          { id: 'soft_palette', label: '柔和彩色' },
          { id: 'dark_mystery', label: '深色神秘' },
          { id: 'bright_clear', label: '明亮清透' },
          { id: 'muted_elegance', label: '低饱和高级感' }
        ]
      },
      {
        label: '服装与轮廓',
        options: [
          { id: 'maid_details', label: '女仆装细节' },
          { id: 'uniform_aesthetic', label: '制服美学' },
          { id: 'futuristic_clothing', label: '未来科技服饰' },
          { id: 'layered_elegance', label: '优雅层叠服装' },
          { id: 'minimal_silhouette', label: '简洁剪裁' },
          { id: 'ornamental_details', label: '精致配饰' }
        ]
      },
      {
        label: '特征与构图',
        options: [
          { id: 'eye_design', label: '鲜明眼部设计' },
          { id: 'hair_motion', label: '长发动态' },
          { id: 'animal_features', label: '动物特征' },
          { id: 'nonhuman_features', label: '非人类肢体' },
          { id: 'expressive_variants', label: '丰富表情差分' },
          { id: 'dramatic_lighting', label: '戏剧化光影' }
        ]
      }
    ]
  },
  {
    id: 'Q7',
    title: '你希望日常互动有哪些细节？',
    hint: '多选，最多 4 项；不表示角色真的拥有这些经历',
    type: 'multi',
    max: 4,
    groups: [
      {
        label: '日常仪式',
        options: [
          { id: 'greeting_ritual', label: '固定问候' },
          { id: 'closing_ritual', label: '收尾总结' },
          { id: 'funny_anecdotes', label: '分享趣事' },
          { id: 'progress_review', label: '定期回顾进展' },
          { id: 'pet_names', label: '专属称呼' },
          { id: 'milestone_ritual', label: '纪念小成就' }
        ]
      },
      {
        label: '兴趣与探索',
        options: [
          { id: 'tech_interests', label: '科技与未来' },
          { id: 'art_interests', label: '艺术与设计' },
          { id: 'music_interests', label: '音乐与声音' },
          { id: 'literature_interests', label: '文学与故事' },
          { id: 'gaming_interests', label: '游戏与互动世界' },
          { id: 'nature_cosmos', label: '自然与宇宙' }
        ]
      },
      {
        label: '日常氛围',
        options: [
          { id: 'casual_daily_talk', label: '轻松闲聊' },
          { id: 'daily_discoveries', label: '分享当日发现' },
          { id: 'small_goals', label: '讨论小目标' },
          { id: 'opinion_exchange', label: '交换观点' },
          { id: 'fictional_daily_scenes', label: '虚构日常情节' },
          { id: 'quiet_presence', label: '安静的陪伴感' }
        ]
      },
      {
        label: '共同成长',
        options: [
          { id: 'skill_progress', label: '技能成长记录' },
          { id: 'shared_projects', label: '共同整理项目' },
          { id: 'long_term_goals', label: '长期目标回顾' },
          { id: 'idea_journal', label: '创意积累' },
          { id: 'preference_review', label: '定期整理偏好' },
          { id: 'shared_lore', label: '保留共同设定' }
        ]
      }
    ]
  },
  {
    id: 'Q8',
    title: '你喜欢怎样逐渐建立熟悉感？',
    hint: '多选，最多 3 项；不推断现实关系身份',
    type: 'multi',
    max: 3,
    groups: [
      {
        label: '熟悉方式',
        options: [
          { id: 'gradual_familiarity', label: '自然渐进' },
          { id: 'fast_rapport', label: '快速建立默契' },
          { id: 'work_before_closeness', label: '先协作再亲近' },
          { id: 'observe_then_trust', label: '先观察再信任' },
          { id: 'shared_interests_first', label: '从共同兴趣切入' },
          { id: 'independent_space', label: '保持独立空间' }
        ]
      },
      {
        label: '亲近速度',
        options: [
          { id: 'slow_burn', label: '慢热型' },
          { id: 'natural_pace', label: '适度自然' },
          { id: 'open_affection', label: '主动表达好感' },
          { id: 'closeness_after_trust', label: '熟悉后明显亲近' },
          { id: 'contextual_affection', label: '由情境触发亲近' },
          { id: 'user_led_pace', label: '由用户决定节奏' }
        ]
      },
      {
        label: '冲突与修复',
        options: [
          { id: 'facts_first', label: '先讲事实' },
          { id: 'direct_conflict', label: '直接指出问题' },
          { id: 'pause_then_talk', label: '暂停后再讨论' },
          { id: 'humor_to_defuse', label: '用幽默缓和' },
          { id: 'state_displeasure', label: '明确表达不满' },
          { id: 'repair_focused', label: '重视道歉与修复' }
        ]
      },
      {
        label: '长期延续',
        options: [
          { id: 'remember_preferences', label: '记住确认过的偏好' },
          { id: 'ongoing_projects', label: '持续推进共同项目' },
          { id: 'evolving_relationship', label: '允许关系状态变化' },
          { id: 'stable_nicknames', label: '保留稳定称呼' },
          { id: 'event_reflection', label: '回顾重要事件' },
          { id: 'no_constant_romance', label: '不要求持续恋爱氛围' }
        ]
      }
    ]
  },
  {
    id: 'Q9',
    title: '技术与研究任务怎样交付最合适？',
    hint: '多选，最多 4 项；不降低准确性与验证要求',
    type: 'multi',
    max: 4,
    groups: [
      {
        label: '答案组织',
        options: [
          { id: 'conclusion_first', label: '结论优先' },
          { id: 'stepwise', label: '步骤分明' },
          { id: 'comparison_tables', label: '表格比较' },
          { id: 'key_points', label: '要点摘要' },
          { id: 'full_report', label: '完整报告' },
          { id: 'deliverable_first', label: '直接给可执行成果' }
        ]
      },
      {
        label: '解释深度',
        options: [
          { id: 'minimal_explanation', label: '仅给必要结论' },
          { id: 'brief_rationale', label: '简要理由' },
          { id: 'mechanism_explanation', label: '解释关键机制' },
          { id: 'worked_examples', label: '提供案例' },
          { id: 'alternatives', label: '比较替代方案' },
          { id: 'deep_reasoning_summary', label: '完整论证' }
        ]
      },
      {
        label: '验证与准确性',
        options: [
          { id: 'explicit_unknowns', label: '明确标出未知' },
          { id: 'source_evidence', label: '提供证据来源' },
          { id: 'test_before_delivery', label: '测试后交付' },
          { id: 'limitations', label: '列出限制' },
          { id: 'risk_assessment', label: '评估风险' },
          { id: 'minimal_reproducible_test', label: '最小可复现验证' }
        ]
      },
      {
        label: '协作与推进',
        options: [
          { id: 'clarify_ambiguity', label: '先问关键歧义' },
          { id: 'proactive_error_detection', label: '主动指出问题' },
          { id: 'minimum_steps', label: '给最少必要步骤' },
          { id: 'staged_delivery', label: '分阶段交付' },
          { id: 'fallback_options', label: '给完整替代方案' },
          { id: 'change_summary', label: '完成后提供变更摘要' }
        ]
      }
    ]
  }
]
