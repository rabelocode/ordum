import { ModuleId, ModuleManifest, FutureModuleManifest } from "../../types";

export const ORDUM_MODULES: Record<ModuleId, ModuleManifest> = {
  integrity: {
    id: "integrity",
    name: "Ordum Integridade",
    shortName: "Integridade",
    tagline: "Confiança para quem relata. Controle para quem apura.",
    description:
      "Disponibilize um canal seguro para denúncias e manifestações, com possibilidade de anonimato, acompanhamento protegido e gestão organizada dos relatos.",
    icon: "ShieldCheck",
    accentColor: "#3457D5",
    darkColor: "#263F9F",
    lightColor: "#E9EDFF",
    basePath: "/workspace/integridade",
    integrationMode: "internal",
    enabled: true,
    quickActions: [
      {
        id: "new_report",
        label: "Novo Registro Interno",
        iconName: "PlusCircle",
        actionUrl: "/workspace/integridade?action=new",
      },
      {
        id: "view_reports",
        label: "Gestão de Relatos",
        iconName: "FileText",
        actionUrl: "/workspace/integridade?tab=reports",
      },
      {
        id: "channel_settings",
        label: "Configurar Canal Público",
        iconName: "Settings",
        actionUrl: "/workspace/integridade?tab=settings",
      },
    ],
    features: [
      "Denúncia anônima ou identificada",
      "Protocolo único de acompanhamento",
      "Comunicação bidirecional protegida",
      "Anexos e gestão de evidências",
      "Classificação e severidade do relato",
      "Atribuição de responsáveis e comitês",
      "Controle rígido de prazos da LGPD/Compliance",
      "Histórico auditável e relatórios gerenciais",
    ],
  },

  people: {
    id: "people",
    name: "Ordum Pessoas",
    shortName: "Pessoas",
    tagline: "Tudo o que o colaborador precisa. Em um só lugar.",
    description:
      "Centralize comunicados, documentos, solicitações e serviços internos em um portal simples para os colaboradores e eficiente para a gestão.",
    icon: "Users",
    accentColor: "#16897A",
    darkColor: "#10685D",
    lightColor: "#E4F5F1",
    basePath: "/workspace/pessoas",
    integrationMode: "internal",
    enabled: true,
    quickActions: [
      {
        id: "publish_announcement",
        label: "Novo Comunicado",
        iconName: "Megaphone",
        actionUrl: "/workspace/pessoas?action=announcement",
      },
      {
        id: "upload_document",
        label: "Enviar Documento",
        iconName: "FileUpload",
        actionUrl: "/workspace/pessoas?action=document",
      },
      {
        id: "view_requests",
        label: "Central de Solicitações",
        iconName: "Inbox",
        actionUrl: "/workspace/pessoas?tab=requests",
      },
    ],
    features: [
      "Portal do colaborador personalizado",
      "Mural de comunicados institucionais",
      "Distribuição de políticas e documentos",
      "Confirmação e protocolo de leitura digital",
      "Abertura de solicitações internas (férias, atestados)",
      "Central unificada de serviços ao colaborador",
      "Acompanhamento de prazos de atendimento",
      "Painel e indicadores de engajamento",
    ],
  },

  talent: {
    id: "talent",
    name: "Ordum Talentos",
    shortName: "Talentos",
    tagline: "Processos seletivos organizados do início à contratação.",
    description:
      "Divulgue oportunidades, centralize candidatos e acompanhe cada etapa do recrutamento com mais clareza, agilidade e consistência.",
    icon: "Briefcase",
    accentColor: "#D98C32",
    darkColor: "#AC6C24",
    lightColor: "#FFF1DD",
    basePath: "/workspace/talentos",
    integrationMode: "internal",
    enabled: true,
    quickActions: [
      {
        id: "create_job",
        label: "Abrir Nova Vaga",
        iconName: "Plus",
        actionUrl: "/workspace/talentos?action=job",
      },
      {
        id: "view_candidates",
        label: "Banco de Candidatos",
        iconName: "UsersCheck",
        actionUrl: "/workspace/talentos?tab=candidates",
      },
      {
        id: "career_page",
        label: "Portal de Carreiras",
        iconName: "Globe",
        actionUrl: "/workspace/talentos?tab=portal",
      },
    ],
    features: [
      "Portal público de vagas customizado",
      "Divulgação e gestão de oportunidades",
      "Banco centralizado de currículos",
      "Pipeline de seleção visual (Kanban)",
      "Triagem e avaliação de candidatos",
      "Histórico de interações por processo",
      "Mensagens automáticas e agendamento",
      "Métricas de tempo de contratação (Time-to-hire)",
    ],
  },
};

export const ORDUM_FUTURE_MODULES: FutureModuleManifest[] = [
  {
    id: "processes",
    name: "Ordum Processos",
    description: "Mapeamento e automação de fluxos corporativos com rastreabilidade.",
    icon: "GitMerge",
    status: "coming_soon",
  },
  {
    id: "documents",
    name: "Ordum Documentos",
    description: "Assinatura digital e gestão temporal de contratos e arquivos.",
    icon: "FileCheck",
    status: "coming_soon",
  },
  {
    id: "tickets",
    name: "Ordum Chamados",
    description: "SLA e atendimento para demandas internas entre áreas.",
    icon: "Headphones",
    status: "coming_soon",
  },
  {
    id: "performance",
    name: "Ordum Desempenho",
    description: "Avaliações 360°, OKRs e planos de desenvolvimento individual (PDI).",
    icon: "TrendingUp",
    status: "roadmap",
  },
  {
    id: "academy",
    name: "Ordum Academia",
    description: "Treinamentos corporativos, trilhas de aprendizagem e certificações.",
    icon: "GraduationCap",
    status: "roadmap",
  },
  {
    id: "metrics",
    name: "Ordum Indicadores",
    description: "Dashboards consolidados executivos para tomada de decisão.",
    icon: "BarChart3",
    status: "roadmap",
  },
];

export class ModuleRegistry {
  public static getAllModules(): ModuleManifest[] {
    return Object.values(ORDUM_MODULES);
  }

  public static getModule(id: ModuleId): ModuleManifest | undefined {
    return ORDUM_MODULES[id];
  }

  public static getEnabledModules(enabledIds: ModuleId[]): ModuleManifest[] {
    return enabledIds
      .map((id) => ORDUM_MODULES[id])
      .filter((mod): mod is ModuleManifest => Boolean(mod && mod.enabled));
  }

  public static getFutureModules(): FutureModuleManifest[] {
    return ORDUM_FUTURE_MODULES;
  }
}
