FROM php:8.4-fpm-alpine

RUN apk add --no-cache libzip-dev icu-dev oniguruma-dev mysql-client git unzip \
 && docker-php-ext-install pdo_mysql bcmath intl zip opcache

# Redis extension
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
 && pecl install redis \
 && docker-php-ext-enable redis \
 && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www
