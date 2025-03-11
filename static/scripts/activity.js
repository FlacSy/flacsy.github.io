class ActivityLoader {
    constructor(username) {
        this.username = username;
        this.apiUrl = `https://api.github.com/users/${username}/events/public`;
    }

    async loadActivity() {
        try {
            const response = await fetch(this.apiUrl);
            const events = await response.json();
            return this.processEvents(events);
        } catch (error) {
            console.error('Ошибка при загрузке активности:', error);
            return [];
        }
    }

    processEvents(events) {
        // Группируем события по репозиторию и типу
        const groupedEvents = this.groupEvents(events);
        
        return groupedEvents
            .filter(event => this.isRelevantEvent(event))
            .slice(0, 5)
            .map(event => this.formatEvent(event));
    }

    groupEvents(events) {
        const grouped = new Map();
        
        events.forEach(event => {
            const key = `${event.repo.name}-${event.type}`;
            if (!grouped.has(key)) {
                grouped.set(key, event);
            } else {
                // Обновляем только если событие новее
                const existing = grouped.get(key);
                if (new Date(event.created_at) > new Date(existing.created_at)) {
                    grouped.set(key, event);
                }
            }
        });

        return Array.from(grouped.values());
    }

    isRelevantEvent(event) {
        // Список значимых типов событий
        const relevantTypes = [
            'PushEvent',
            'CreateEvent',
            'ReleaseEvent'
        ];

        if (!relevantTypes.includes(event.type)) {
            return false;
        }

        // Дополнительная фильтрация по типу события
        switch (event.type) {
            case 'PushEvent':
                // Проверяем, что в пуше есть значимые изменения
                return event.payload.commits && 
                       event.payload.commits.length > 0 && 
                       !event.payload.commits[0].message.toLowerCase().includes('merge') &&
                       !event.payload.commits[0].message.toLowerCase().includes('initial');
            
            case 'CreateEvent':
                // Только создание репозиториев или релизов
                return ['repository', 'tag'].includes(event.payload.ref_type);
            
            case 'ReleaseEvent':
                // Только публикация релизов
                return event.payload.action === 'published';
            
            default:
                return false;
        }
    }

    formatEvent(event) {
        const eventData = {
            title: this.getEventTitle(event),
            description: this.getEventDescription(event),
            date: this.formatDate(new Date(event.created_at)),
            icon: this.getEventIcon(event.type),
            url: this.getEventUrl(event)
        };
        return eventData;
    }

    getEventTitle(event) {
        const repoName = event.repo.name.split('/')[1];
        
        switch (event.type) {
            case 'PushEvent':
                const commitMessage = event.payload.commits[0].message.split('\n')[0];
                return `Обновление ${repoName}: ${commitMessage}`;
                
            case 'CreateEvent':
                if (event.payload.ref_type === 'repository') {
                    return `Новый проект: ${repoName}`;
                }
                return `Новый релиз ${event.payload.ref} для ${repoName}`;
                
            case 'ReleaseEvent':
                return `Релиз ${event.payload.release.tag_name} для ${repoName}`;
                
            default:
                return `Активность в ${repoName}`;
        }
    }

    getEventDescription(event) {
        switch (event.type) {
            case 'PushEvent':
                const commitCount = event.payload.commits.length;
                return commitCount > 1 
                    ? `Добавлено ${commitCount} изменений`
                    : 'Добавлено изменение';
                
            case 'CreateEvent':
                if (event.payload.ref_type === 'repository') {
                    return 'Создан новый репозиторий';
                }
                return `Создан новый ${event.payload.ref_type}`;
                
            case 'ReleaseEvent':
                return event.payload.release.name || 'Новый релиз';
                
            default:
                return '';
        }
    }

    getEventUrl(event) {
        switch (event.type) {
            case 'PushEvent':
                return `https://github.com/${event.repo.name}/commit/${event.payload.head}`;
            case 'ReleaseEvent':
                return event.payload.release.html_url;
            default:
                return `https://github.com/${event.repo.name}`;
        }
    }

    getEventIcon(eventType) {
        const icons = {
            PushEvent: `<svg class="activity-icon" viewBox="0 0 24 24">
                <path d="M2.5 3.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75zM2.5 7.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75zM2.5 11.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75zM2.5 15.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75z"/>
            </svg>`,
            CreateEvent: `<svg class="activity-icon" viewBox="0 0 24 24">
                <path d="M11.75 4.5a.75.75 0 0 1 .75.75V11h5.75a.75.75 0 0 1 0 1.5H12.5v5.75a.75.75 0 0 1-1.5 0V12.5H5.25a.75.75 0 0 1 0-1.5H11V5.25a.75.75 0 0 1 .75-.75z"/>
            </svg>`,
            ReleaseEvent: `<svg class="activity-icon" viewBox="0 0 24 24">
                <path d="M8.75 7.25a.75.75 0 0 1 .75.75v3.25h3.25a.75.75 0 0 1 0 1.5H9.5v3.25a.75.75 0 0 1-1.5 0V12.5H4.75a.75.75 0 0 1 0-1.5H8V8a.75.75 0 0 1 .75-.75z"/>
            </svg>`
        };

        return icons[eventType] || icons.PushEvent;
    }

    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            if (days === 1) return 'вчера';
            if (days < 7) return `${days} ${this.declOfNum(days, ['день', 'дня', 'дней'])} назад`;
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long'
            });
        } else if (hours > 0) {
            return `${hours} ${this.declOfNum(hours, ['час', 'часа', 'часов'])} назад`;
        } else if (minutes > 0) {
            return `${minutes} ${this.declOfNum(minutes, ['минуту', 'минуты', 'минут'])} назад`;
        } else {
            return 'только что';
        }
    }

    declOfNum(n, titles) {
        return titles[
            n % 10 === 1 && n % 100 !== 11 
                ? 0 
                : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) 
                    ? 1 
                    : 2
        ];
    }
}

async function displayActivity() {
    const activityLoader = new ActivityLoader('FlacSy');
    const activityList = document.querySelector('.activity-list');
    
    if (!activityList) return;

    activityList.innerHTML = '<div class="loading">Загрузка активности...</div>';

    try {
        const activities = await activityLoader.loadActivity();
        
        if (activities.length === 0) {
            activityList.innerHTML = '<div class="no-activity">Нет недавней активности</div>';
            return;
        }

        activityList.innerHTML = activities
            .map(activity => `
                <a href="${activity.url}" class="activity-item" target="_blank">
                    ${activity.icon}
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-date">${activity.date}</div>
                    </div>
                </a>
            `)
            .join('');
    } catch (error) {
        activityList.innerHTML = '<div class="error">Ошибка при загрузке активности</div>';
    }
}

document.addEventListener('DOMContentLoaded', displayActivity); 